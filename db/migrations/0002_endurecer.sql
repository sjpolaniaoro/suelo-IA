-- Endurece lo que marcó el asesor de seguridad de Supabase.
--   * El disparador de solo anexar no usa objetos de esquema: se fija un search_path vacío.
--   * Nadie inicia sesión en Suelo-IA (no hay cuentas), así que el rol authenticated no necesita
--     ejecutar las funciones; solo anon, y con el código de equipo.
-- Los avisos «RLS sin políticas» y «anon ejecuta SECURITY DEFINER» son intencionales: las tablas
-- se cierran a todos los roles y las dos funciones exigen el código antes de hacer nada.

alter function public.revisiones_solo_anexar() set search_path = '';

revoke execute on function public.registrar_revision(uuid, text, text, text, text, timestamptz, integer, text, text, text, text)
  from authenticated;
revoke execute on function public.leer_revisiones(text) from authenticated;
