-- Límite de intentos del código de equipo (arreglo de la auditoría de seguridad, corrida 1).
--
-- Antes: cada llamada anónima con un código distinto costaba un bcrypt y no había contador ni bloqueo.
-- Ahora: los fallos se cuentan por cliente (cf-connecting-ip, si no el último elemento de
-- x-forwarded-for) y en un cubo global; tras el umbral hay bloqueo con espera exponencial y, mientras
-- dura, no se ejecuta crypt().
--
-- Un RAISE revertiría el contador, así que las funciones públicas ya no lanzan error ante un código
-- malo: devuelven jsonb {ok:false, error:'codigo_invalido'|'demasiados_intentos'}. El cliente nuevo
-- entiende las dos formas, de modo que se puede desplegar antes o después de esta migración.
-- Como las funciones ahora escriben, son VOLATILE y PostgREST ya no las admite por GET.

create table public.intentos_codigo (
  clave text primary key,
  fallos integer not null default 0,
  ultimo timestamptz not null default now(),
  bloqueado_hasta timestamptz
);
alter table public.intentos_codigo enable row level security;
revoke all on public.intentos_codigo from anon, authenticated;

create function public.registrar_fallo(p_clave text, p_umbral integer, p_base_seg integer) returns void
language plpgsql set search_path = public as $$
declare
  v_fallos integer;
begin
  insert into public.intentos_codigo as i (clave, fallos, ultimo)
  values (p_clave, 1, now())
  on conflict (clave) do update
    set fallos = case when i.ultimo < now() - interval '1 hour' then 1 else i.fallos + 1 end,
        ultimo = now()
  returning i.fallos into v_fallos;
  if v_fallos >= p_umbral then
    update public.intentos_codigo
      set bloqueado_hasta = now() + least(interval '1 hour', make_interval(secs => p_base_seg * power(2, v_fallos - p_umbral)))
      where clave = p_clave;
  end if;
end;
$$;

create function public.verificar_codigo(p_codigo text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_headers json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  v_ip text := coalesce(
    nullif(btrim(v_headers->>'cf-connecting-ip'), ''),
    nullif(btrim(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', -1)), ''),
    'sin-ip');
  v_clave text := 'ip:' || left(v_ip, 64);
  v_bloqueo timestamptz;
begin
  select max(bloqueado_hasta) into v_bloqueo from public.intentos_codigo where clave in (v_clave, 'global');
  if v_bloqueo is not null and v_bloqueo > now() then
    return 'demasiados_intentos';
  end if;
  if public.codigo_valido(p_codigo) then
    delete from public.intentos_codigo where clave = v_clave;
    return 'ok';
  end if;
  perform public.registrar_fallo(v_clave, 5, 30);      -- por cliente: 5 fallos, luego 30 s, 60 s, 120 s... hasta 1 h
  perform public.registrar_fallo('global', 40, 60);    -- respaldo contra muchos clientes: 40 fallos, luego 60 s, 120 s...
  if random() < 0.01 then
    delete from public.intentos_codigo where ultimo < now() - interval '1 day';
  end if;
  return 'codigo_invalido';
end;
$$;

drop function public.registrar_revision(uuid, text, text, text, text, timestamptz, integer, text, text, text, text);
drop function public.leer_revisiones(text);

create function public.registrar_revision(
  p_id uuid, p_npn text, p_estado text, p_revisor text, p_codigo text, p_fecha timestamptz,
  p_puntaje integer default null, p_alertas text default null, p_triangulacion text default null,
  p_accion text default null, p_version text default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_resultado text;
  v_filas integer;
begin
  v_resultado := public.verificar_codigo(p_codigo);
  if v_resultado <> 'ok' then
    return jsonb_build_object('ok', false, 'error', v_resultado);
  end if;
  insert into public.revisiones
    (id, npn, estado, revisor, fecha_cliente, puntaje, alertas, triangulacion, accion, version_datos)
  values
    (p_id, p_npn, p_estado, btrim(p_revisor), p_fecha, p_puntaje, p_alertas, p_triangulacion, p_accion, p_version)
  on conflict (id) do nothing;
  get diagnostics v_filas = row_count;
  return jsonb_build_object('ok', true, 'id', p_id, 'nueva', v_filas = 1);
end;
$$;

create function public.leer_revisiones(p_codigo text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_resultado text;
begin
  v_resultado := public.verificar_codigo(p_codigo);
  if v_resultado <> 'ok' then
    return jsonb_build_object('ok', false, 'error', v_resultado);
  end if;
  return jsonb_build_object('ok', true, 'filas', coalesce((
    select jsonb_agg(to_jsonb(u))
    from (
      select distinct on (r.npn) r.id, r.npn, r.estado, r.revisor, r.fecha_cliente
      from public.revisiones r
      order by r.npn, r.fecha_cliente desc, r.creada_en desc
    ) u
    where u.estado <> 'quitada'
  ), '[]'::jsonb));
end;
$$;

revoke all on function public.registrar_fallo(text, integer, integer) from public, anon, authenticated;
revoke all on function public.verificar_codigo(text) from public, anon, authenticated;
revoke all on function public.registrar_revision(uuid, text, text, text, text, timestamptz, integer, text, text, text, text) from public, authenticated;
revoke all on function public.leer_revisiones(text) from public, authenticated;
grant execute on function public.registrar_revision(uuid, text, text, text, text, timestamptz, integer, text, text, text, text) to anon;
grant execute on function public.leer_revisiones(text) to anon;
