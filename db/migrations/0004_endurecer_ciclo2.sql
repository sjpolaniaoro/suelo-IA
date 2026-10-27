-- Arreglos del ciclo 2 de la auditoría de seguridad.
--   * registrar_revision rechaza una fecha_cliente futura (más de un día) o anterior a 2020: la fecha decide
--     qué evento es el vigente, y con la tabla de solo anexar una fecha lejana no se puede corregir.
--   * registrar_fallo limita el exponente: sin tope, a partir del fallo 39 el intervalo desbordaba.
--   * Las funciones con SECURITY DEFINER fijan search_path vacío y califican sus objetos (public., extensions.).
--   * El cliente IPv6 se agrupa por su /64: una sola persona controla un /64 entero y cambiaba de clave a voluntad.
-- Comprobado en producción antes de esta migración: el borde de Supabase ignora un X-Forwarded-For falso,
-- bloquea un cf-connecting-ip falso y PostgREST ignora «Prefer: tx=rollback» (el contador no se revierte).

create or replace function public.registrar_fallo(p_clave text, p_umbral integer, p_base_seg integer) returns void
language plpgsql set search_path = '' as $$
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
      set bloqueado_hasta = now() + least(interval '1 hour',
            make_interval(secs => p_base_seg * power(2, least(v_fallos - p_umbral, 12))))
      where clave = p_clave;
  end if;
end;
$$;

create or replace function public.codigo_valido(p_codigo text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.equipo_codigo
    where p_codigo is not null and codigo_hash = extensions.crypt(p_codigo, codigo_hash)
  );
$$;

create or replace function public.verificar_codigo(p_codigo text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_headers json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  v_ip text := coalesce(
    nullif(btrim(v_headers->>'cf-connecting-ip'), ''),
    nullif(btrim(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', -1)), ''),
    'sin-ip');
  v_clave text;
  v_bloqueo timestamptz;
begin
  begin
    -- IPv4 tal cual; IPv6 agrupada por su /64. Un valor que no es una IP se deja como está.
    v_ip := host(network(set_masklen(v_ip::inet, case when family(v_ip::inet) = 6 then 64 else 32 end)));
  exception when others then
    null;
  end;
  v_clave := 'ip:' || left(v_ip, 64);
  select max(bloqueado_hasta) into v_bloqueo from public.intentos_codigo where clave in (v_clave, 'global');
  if v_bloqueo is not null and v_bloqueo > now() then
    return 'demasiados_intentos';
  end if;
  if public.codigo_valido(p_codigo) then
    delete from public.intentos_codigo where clave = v_clave;
    return 'ok';
  end if;
  perform public.registrar_fallo(v_clave, 5, 30);
  perform public.registrar_fallo('global', 40, 60);
  if random() < 0.01 then
    delete from public.intentos_codigo where ultimo < now() - interval '1 day';
  end if;
  return 'codigo_invalido';
end;
$$;

create or replace function public.registrar_revision(
  p_id uuid, p_npn text, p_estado text, p_revisor text, p_codigo text, p_fecha timestamptz,
  p_puntaje integer default null, p_alertas text default null, p_triangulacion text default null,
  p_accion text default null, p_version text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_resultado text;
  v_filas integer;
begin
  v_resultado := public.verificar_codigo(p_codigo);
  if v_resultado <> 'ok' then
    return jsonb_build_object('ok', false, 'error', v_resultado);
  end if;
  if p_fecha is null or p_fecha > now() + interval '1 day' or p_fecha < timestamptz '2020-01-01' then
    return jsonb_build_object('ok', false, 'error', 'fecha_invalida');
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

create or replace function public.leer_revisiones(p_codigo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
