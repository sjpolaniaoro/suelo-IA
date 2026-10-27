-- Revisiones humanas de Suelo-IA (Supabase / Postgres).
--
-- Diseño:
--   * Registro de eventos de solo anexar: cada decisión es una fila nueva; nada se actualiza ni se borra.
--     «Quitar» una revisión es un evento más (estado 'quitada'). Así se conserva el historial completo.
--   * Nadie accede a las tablas directamente. El navegador solo llama a dos funciones, y ambas exigen
--     el código de equipo (se guarda como hash; el código nunca queda en el repositorio).
--   * Datos personales: solo el nombre básico de quien revisa (2 a 60 caracteres). No se guardan
--     documentos, correos ni teléfonos.
--   * Cada evento guarda una foto de la alerta al revisar (puntaje, alertas, triangulación, cola y versión
--     de los datos) para medir después la precisión por tipo de evidencia.

create extension if not exists pgcrypto with schema extensions;

create table public.revisiones (
  id uuid primary key,                       -- lo genera el cliente: reintentos idempotentes
  npn text not null check (npn ~ '^[0-9]{30}$'),
  estado text not null check (estado in ('confirmado', 'descartado', 'no_concluyente', 'quitada')),
  revisor text not null check (char_length(btrim(revisor)) between 2 and 60),
  fecha_cliente timestamptz not null,        -- cuándo decidió la persona (puede ser sin conexión)
  creada_en timestamptz not null default now(),
  puntaje integer check (puntaje between 0 and 100),
  alertas text check (char_length(alertas) <= 40),
  triangulacion text check (triangulacion in ('dos_fuentes', 'solo_cartografia', 'solo_imagen', 'sin_evidencia')),
  accion text check (accion in ('oficina', 'campo')),
  version_datos text check (char_length(version_datos) <= 40)
);

create index revisiones_npn_idx on public.revisiones (npn, fecha_cliente desc, creada_en desc);

create table public.equipo_codigo (
  id boolean primary key default true check (id),   -- una sola fila
  codigo_hash text not null
);

alter table public.revisiones enable row level security;
alter table public.equipo_codigo enable row level security;
-- Sin políticas: los roles anon y authenticated no pueden leer ni escribir las tablas.
revoke all on public.revisiones from anon, authenticated;
revoke all on public.equipo_codigo from anon, authenticated;

-- Solo anexar: ni siquiera quien tenga acceso por error puede cambiar o borrar el historial.
create function public.revisiones_solo_anexar() returns trigger
language plpgsql as $$
begin
  raise exception 'revisiones es un registro de solo anexar' using errcode = '42501';
end;
$$;

create trigger revisiones_sin_cambios
  before update or delete on public.revisiones
  for each row execute function public.revisiones_solo_anexar();
create trigger revisiones_sin_vaciado
  before truncate on public.revisiones
  for each statement execute function public.revisiones_solo_anexar();

create function public.codigo_valido(p_codigo text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.equipo_codigo
    where p_codigo is not null and codigo_hash = crypt(p_codigo, codigo_hash)
  );
$$;

create function public.registrar_revision(
  p_id uuid, p_npn text, p_estado text, p_revisor text, p_codigo text, p_fecha timestamptz,
  p_puntaje integer default null, p_alertas text default null, p_triangulacion text default null,
  p_accion text default null, p_version text default null
) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.codigo_valido(p_codigo) then
    raise exception 'codigo_invalido' using errcode = '28000';
  end if;
  insert into public.revisiones
    (id, npn, estado, revisor, fecha_cliente, puntaje, alertas, triangulacion, accion, version_datos)
  values
    (p_id, p_npn, p_estado, btrim(p_revisor), p_fecha, p_puntaje, p_alertas, p_triangulacion, p_accion, p_version)
  on conflict (id) do nothing;
  return p_id;
end;
$$;

-- Estado vigente de cada predio: el último evento, sin contar los quitados.
create function public.leer_revisiones(p_codigo text)
returns table (id uuid, npn text, estado text, revisor text, fecha_cliente timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if not public.codigo_valido(p_codigo) then
    raise exception 'codigo_invalido' using errcode = '28000';
  end if;
  return query
    select u.id, u.npn, u.estado, u.revisor, u.fecha_cliente
    from (
      select distinct on (r.npn) r.id, r.npn, r.estado, r.revisor, r.fecha_cliente
      from public.revisiones r
      order by r.npn, r.fecha_cliente desc, r.creada_en desc
    ) u
    where u.estado <> 'quitada';
end;
$$;

revoke all on function public.codigo_valido(text) from public, anon, authenticated;
revoke all on function public.registrar_revision(uuid, text, text, text, text, timestamptz, integer, text, text, text, text)
  from public;
revoke all on function public.leer_revisiones(text) from public;
grant execute on function public.registrar_revision(uuid, text, text, text, text, timestamptz, integer, text, text, text, text)
  to anon, authenticated;
grant execute on function public.leer_revisiones(text) to anon, authenticated;
