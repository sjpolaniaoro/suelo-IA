-- Quién revisa: grupo y contacto (ambos opcionales en la base; el cliente exige el grupo).
--   * Cada evento guarda además el grupo de quien revisa y, si la persona quiso dejarlo, un contacto
--     (correo o teléfono) para poder preguntarle por su revisión.
--   * `creada_en` (default now(), hora del servidor al recibir el dato) ya existía desde la 0001: no se
--     toca. `fecha_cliente` sigue siendo cuándo decidió la persona, y puede venir de una cola sin conexión.
--   * No se deduplica nada: varias personas pueden revisar el mismo predio, y la misma persona puede repetir.
--     Cada intento es una fila; el análisis se hace después con npn, revisor, grupo, fecha_cliente y creada_en.
--   * El contacto NO se devuelve en leer_revisiones: ningún otro cliente lo ve. Solo se lee en el editor SQL.
-- La tabla es de solo anexar (disparador de la 0001); agregar columnas no lo afecta.

alter table public.revisiones
  add column grupo text check (grupo is null or char_length(btrim(grupo)) between 1 and 60),
  add column contacto text check (contacto is null or char_length(btrim(contacto)) between 3 and 120);

drop function public.registrar_revision(uuid, text, text, text, text, timestamptz, integer, text, text, text, text);

create function public.registrar_revision(
  p_id uuid, p_npn text, p_estado text, p_revisor text, p_codigo text, p_fecha timestamptz,
  p_puntaje integer default null, p_alertas text default null, p_triangulacion text default null,
  p_accion text default null, p_version text default null,
  p_grupo text default null, p_contacto text default null
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
    (id, npn, estado, revisor, fecha_cliente, puntaje, alertas, triangulacion, accion, version_datos, grupo, contacto)
  values
    (p_id, p_npn, p_estado, btrim(p_revisor), p_fecha, p_puntaje, p_alertas, p_triangulacion, p_accion, p_version,
     nullif(btrim(p_grupo), ''), nullif(btrim(p_contacto), ''))
  on conflict (id) do nothing;
  get diagnostics v_filas = row_count;
  return jsonb_build_object('ok', true, 'id', p_id, 'nueva', v_filas = 1);
end;
$$;

revoke all on function public.registrar_revision(uuid, text, text, text, text, timestamptz, integer, text, text, text, text, text, text)
  from public, authenticated;
grant execute on function public.registrar_revision(uuid, text, text, text, text, timestamptz, integer, text, text, text, text, text, text)
  to anon;
