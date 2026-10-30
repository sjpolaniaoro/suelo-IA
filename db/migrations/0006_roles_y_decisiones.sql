-- Roles (invitado / funcionario), equipos con su propio código y decisiones explícitas.
--
--   * Invitado: envía revisiones sin código. El servidor lo marca rol = 'invitado' (el cliente no lo decide),
--     guarda el grupo «Invitado», no guarda contacto, limita los envíos por cliente y por día, y no lee nada.
--   * Funcionario: entra con el código de su equipo. Cada equipo tiene su código (tabla `equipos`).
--     El código único anterior pasa al equipo `testing`, marcado es_prueba: queda fuera de las métricas.
--   * Decisiones: `motivo` (insuficiente | no_ubicado) separa los dos «no concluyente», y `fuente_error`
--     (registro | cartografia | imagen | ninguna) dice qué fuente tenía el error. Ambos son opcionales.
--   * Métricas oficiales: la vista `revisiones_validas` deja solo lo de funcionarios fuera de prueba y lo de
--     invitados que un funcionario ratificó (`ratificaciones`). Sin acceso para anon ni authenticated.
--
-- Compatible hacia atrás: `registrar_revision` (13 argumentos) y `leer_revisiones` siguen funcionando con el
-- cliente anterior; las funciones nuevas son `registrar_revision_v2`, `leer_revisiones_v2` y `ratificar_revision`.
-- Requiere la 0005 (grupo y contacto). La tabla `revisiones` sigue siendo de solo anexar.

-- ---------- Equipos ----------
create table public.equipos (
  nombre text primary key check (char_length(btrim(nombre)) between 2 and 40),
  codigo_hash text not null,
  es_prueba boolean not null default false,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
alter table public.equipos enable row level security;
revoke all on public.equipos from anon, authenticated;

-- El código de equipo vigente (el hash de siempre; el código nunca está en el repositorio) pasa a `testing`.
insert into public.equipos (nombre, codigo_hash, es_prueba)
select 'testing', codigo_hash, true from public.equipo_codigo
on conflict (nombre) do nothing;

comment on table public.equipo_codigo is 'En desuso desde la 0006: los códigos viven en public.equipos.';

create function public.equipo_de_codigo(p_codigo text) returns text
language sql stable security definer set search_path = '' as $$
  select e.nombre from public.equipos e
  where e.activo and p_codigo is not null and e.codigo_hash = extensions.crypt(p_codigo, e.codigo_hash)
  limit 1;
$$;

-- La verificación con límite de intentos (0003 y 0004) ahora consulta todos los equipos.
create or replace function public.codigo_valido(p_codigo text) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.equipo_de_codigo(p_codigo) is not null;
$$;

-- ---------- Columnas nuevas de las revisiones ----------
alter table public.revisiones
  add column rol text check (rol in ('invitado', 'funcionario')),
  add column equipo text,
  add column es_prueba boolean not null default false,
  add column motivo text check (motivo in ('insuficiente', 'no_ubicado')),
  add column fuente_error text check (fuente_error in ('registro', 'cartografia', 'imagen', 'ninguna')),
  add constraint revisiones_motivo_solo_no_concluyente check (motivo is null or estado = 'no_concluyente');

-- ---------- Ratificaciones (un funcionario respalda la decisión de un invitado) ----------
create table public.ratificaciones (
  id uuid primary key,
  revision_id uuid not null references public.revisiones (id),
  revisor text not null check (char_length(btrim(revisor)) between 2 and 60),
  equipo text not null,
  es_prueba boolean not null default false,
  creada_en timestamptz not null default now(),
  unique (revision_id, equipo)
);
alter table public.ratificaciones enable row level security;
revoke all on public.ratificaciones from anon, authenticated;
create trigger ratificaciones_sin_cambios
  before update or delete on public.ratificaciones
  for each row execute function public.revisiones_solo_anexar();
create trigger ratificaciones_sin_vaciado
  before truncate on public.ratificaciones
  for each statement execute function public.revisiones_solo_anexar();

create view public.revisiones_validas with (security_invoker = true) as
select r.*
from public.revisiones r
where r.rol is null                                        -- anteriores a la 0006: siempre con código de equipo
   or (r.rol = 'funcionario' and not r.es_prueba)
   or (r.rol = 'invitado' and exists (
         select 1 from public.ratificaciones x where x.revision_id = r.id and not x.es_prueba));
revoke all on public.revisiones_validas from public, anon, authenticated;

-- ---------- Límite de envíos de invitados ----------
create table public.envios_invitado (
  clave text not null,
  dia date not null default current_date,
  n integer not null default 0,
  primary key (clave, dia)
);
alter table public.envios_invitado enable row level security;
revoke all on public.envios_invitado from anon, authenticated;

-- Misma clave de cliente que usa el límite de intentos: IPv4 tal cual, IPv6 por su /64.
create function public.clave_cliente() returns text
language plpgsql stable set search_path = '' as $$
declare
  v_headers json := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json;
  v_ip text := coalesce(
    nullif(btrim(v_headers->>'cf-connecting-ip'), ''),
    nullif(btrim(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', -1)), ''),
    'sin-ip');
begin
  begin
    v_ip := host(network(set_masklen(v_ip::inet, case when family(v_ip::inet) = 6 then 64 else 32 end)));
  exception when others then
    null;
  end;
  return 'ip:' || left(v_ip, 64);
end;
$$;

-- Cuenta un envío de invitado: 300 por cliente y por día, 3.000 entre todos. 'ok' o 'demasiados_envios'.
create function public.contar_envio_invitado() returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_cliente integer;
  v_global integer;
begin
  insert into public.envios_invitado as e (clave, dia, n) values (public.clave_cliente(), current_date, 1)
  on conflict (clave, dia) do update set n = e.n + 1
  returning e.n into v_cliente;
  insert into public.envios_invitado as e (clave, dia, n) values ('global', current_date, 1)
  on conflict (clave, dia) do update set n = e.n + 1
  returning e.n into v_global;
  if random() < 0.01 then
    delete from public.envios_invitado where dia < current_date - 2;
  end if;
  if v_cliente > 300 or v_global > 3000 then
    return 'demasiados_envios';
  end if;
  return 'ok';
end;
$$;

-- ---------- Registrar ----------
create function public.registrar_revision_v2(
  p_id uuid, p_npn text, p_estado text, p_revisor text, p_codigo text, p_fecha timestamptz,
  p_puntaje integer default null, p_alertas text default null, p_triangulacion text default null,
  p_accion text default null, p_version text default null,
  p_grupo text default null, p_contacto text default null,
  p_motivo text default null, p_fuente_error text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_resultado text;
  v_equipo text;
  v_prueba boolean := false;
  v_rol text;
  v_filas integer;
begin
  if p_codigo is null or btrim(p_codigo) = '' then
    -- Invitado: sin código. El rol lo decide el servidor, no el cliente.
    v_rol := 'invitado';
    if public.contar_envio_invitado() <> 'ok' then
      return jsonb_build_object('ok', false, 'error', 'demasiados_envios');
    end if;
  else
    v_resultado := public.verificar_codigo(p_codigo);
    if v_resultado <> 'ok' then
      return jsonb_build_object('ok', false, 'error', v_resultado);
    end if;
    v_rol := 'funcionario';
    v_equipo := public.equipo_de_codigo(p_codigo);
    select e.es_prueba into v_prueba from public.equipos e where e.nombre = v_equipo;
  end if;
  if p_fecha is null or p_fecha > now() + interval '1 day' or p_fecha < timestamptz '2020-01-01' then
    return jsonb_build_object('ok', false, 'error', 'fecha_invalida');
  end if;
  insert into public.revisiones
    (id, npn, estado, revisor, fecha_cliente, puntaje, alertas, triangulacion, accion, version_datos,
     grupo, contacto, rol, equipo, es_prueba, motivo, fuente_error)
  values
    (p_id, p_npn, p_estado, btrim(p_revisor), p_fecha, p_puntaje, p_alertas, p_triangulacion, p_accion, p_version,
     case when v_rol = 'invitado' then 'Invitado' else coalesce(nullif(btrim(p_grupo), ''), v_equipo) end,
     case when v_rol = 'invitado' then null else nullif(btrim(p_contacto), '') end,
     v_rol, v_equipo, coalesce(v_prueba, false), nullif(btrim(p_motivo), ''), nullif(btrim(p_fuente_error), ''))
  on conflict (id) do nothing;
  get diagnostics v_filas = row_count;
  return jsonb_build_object('ok', true, 'id', p_id, 'nueva', v_filas = 1, 'rol', v_rol, 'equipo', v_equipo);
end;
$$;

-- El cliente anterior (13 argumentos) sigue funcionando y ahora deja rol, equipo y prueba.
create or replace function public.registrar_revision(
  p_id uuid, p_npn text, p_estado text, p_revisor text, p_codigo text, p_fecha timestamptz,
  p_puntaje integer default null, p_alertas text default null, p_triangulacion text default null,
  p_accion text default null, p_version text default null,
  p_grupo text default null, p_contacto text default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if p_codigo is null or btrim(p_codigo) = '' then
    return jsonb_build_object('ok', false, 'error', 'codigo_invalido');
  end if;
  return public.registrar_revision_v2(
    p_id, p_npn, p_estado, p_revisor, p_codigo, p_fecha, p_puntaje, p_alertas, p_triangulacion,
    p_accion, p_version, p_grupo, p_contacto, null, null);
end;
$$;

-- ---------- Leer (solo funcionarios) ----------
-- Estado vigente de cada predio. Un equipo de prueba ve todo; los demás no ven lo de los equipos de prueba.
-- El contacto no se devuelve. `ratificada` dice si un funcionario respaldó una decisión de invitado.
create function public.leer_revisiones_v2(p_codigo text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_resultado text;
  v_equipo text;
  v_prueba boolean;
begin
  v_resultado := public.verificar_codigo(p_codigo);
  if v_resultado <> 'ok' then
    return jsonb_build_object('ok', false, 'error', v_resultado);
  end if;
  v_equipo := public.equipo_de_codigo(p_codigo);
  select e.es_prueba into v_prueba from public.equipos e where e.nombre = v_equipo;
  return jsonb_build_object('ok', true, 'equipo', v_equipo, 'es_prueba', v_prueba, 'filas', coalesce((
    select jsonb_agg(to_jsonb(u))
    from (
      select distinct on (r.npn)
        r.id, r.npn, r.estado, r.revisor, r.grupo, r.rol, r.equipo, r.motivo, r.fuente_error, r.fecha_cliente,
        exists (select 1 from public.ratificaciones x where x.revision_id = r.id) as ratificada
      from public.revisiones r
      where v_prueba or not r.es_prueba
      order by r.npn, r.fecha_cliente desc, r.creada_en desc
    ) u
    where u.estado <> 'quitada'
  ), '[]'::jsonb));
end;
$$;

-- ---------- Ratificar ----------
create function public.ratificar_revision(p_id uuid, p_codigo text, p_revisor text, p_ratificacion_id uuid)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_resultado text;
  v_equipo text;
  v_prueba boolean;
  v_filas integer;
begin
  v_resultado := public.verificar_codigo(p_codigo);
  if v_resultado <> 'ok' then
    return jsonb_build_object('ok', false, 'error', v_resultado);
  end if;
  v_equipo := public.equipo_de_codigo(p_codigo);
  select e.es_prueba into v_prueba from public.equipos e where e.nombre = v_equipo;
  if not exists (select 1 from public.revisiones r where r.id = p_id and r.rol = 'invitado') then
    return jsonb_build_object('ok', false, 'error', 'no_es_de_invitado');
  end if;
  insert into public.ratificaciones (id, revision_id, revisor, equipo, es_prueba)
  values (p_ratificacion_id, p_id, btrim(p_revisor), v_equipo, coalesce(v_prueba, false))
  on conflict do nothing;
  get diagnostics v_filas = row_count;
  return jsonb_build_object('ok', true, 'nueva', v_filas = 1);
end;
$$;

-- ---------- Permisos ----------
revoke all on function public.equipo_de_codigo(text) from public, anon, authenticated;
revoke all on function public.clave_cliente() from public, anon, authenticated;
revoke all on function public.contar_envio_invitado() from public, anon, authenticated;
revoke all on function public.registrar_revision_v2(uuid, text, text, text, text, timestamptz, integer, text, text, text, text, text, text, text, text)
  from public, authenticated;
revoke all on function public.leer_revisiones_v2(text) from public, authenticated;
revoke all on function public.ratificar_revision(uuid, text, text, uuid) from public, authenticated;
revoke all on function public.registrar_revision(uuid, text, text, text, text, timestamptz, integer, text, text, text, text, text, text)
  from public, authenticated;
grant execute on function public.registrar_revision_v2(uuid, text, text, text, text, timestamptz, integer, text, text, text, text, text, text, text, text) to anon;
grant execute on function public.leer_revisiones_v2(text) to anon;
grant execute on function public.ratificar_revision(uuid, text, text, uuid) to anon;
grant execute on function public.registrar_revision(uuid, text, text, text, text, timestamptz, integer, text, text, text, text, text, text) to anon;
