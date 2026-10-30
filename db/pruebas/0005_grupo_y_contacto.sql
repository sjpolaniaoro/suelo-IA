-- Pruebas de 0005_grupo_y_contacto.sql. Se ejecutan DESPUÉS de aplicar la migración y terminan con un
-- RAISE EXCEPTION que revierte todo: no dejan filas (la tabla de revisiones es de solo anexar).
-- Sustituye CODIGO_REAL por el código vigente al correrla.
do $$
declare
  c text := 'CODIGO_REAL';
  r jsonb;
  f record;
  n integer;
  informe text := '';
  v_npn text := '410010102000000600014000000000';
begin
  perform set_config('request.headers', '{"cf-connecting-ip":"7.7.7.7"}', true);
  -- 1) guarda grupo y contacto, recortados, y la hora de recepción del servidor
  r := public.registrar_revision('22222222-2222-4222-8222-222222222222', v_npn, 'confirmado', ' Ana ', c, now() - interval '5 minutes',
                                 70, 'A1', 'dos_fuentes', 'oficina', 'v', ' Grupo 3 ', ' ana@correo.co ');
  select * into f from public.revisiones where id = '22222222-2222-4222-8222-222222222222';
  informe := informe || case when (r->>'ok')::boolean and f.grupo = 'Grupo 3' and f.contacto = 'ana@correo.co'
    then 'ok guarda grupo y contacto; ' else 'FALLO: no guardó grupo y contacto; ' end;
  informe := informe || case when f.creada_en >= now() - interval '1 minute' and f.fecha_cliente < f.creada_en
    then 'ok creada_en es la hora de recepción; ' else 'FALLO: creada_en; ' end;
  -- 2) sin grupo ni contacto (clientes anteriores) sigue funcionando
  r := public.registrar_revision('33333333-3333-4333-8333-333333333333', v_npn, 'descartado', 'Luis', c, now());
  select * into f from public.revisiones where id = '33333333-3333-4333-8333-333333333333';
  informe := informe || case when (r->>'ok')::boolean and f.grupo is null and f.contacto is null
    then 'ok sin grupo ni contacto; ' else 'FALLO: sin grupo ni contacto; ' end;
  -- 3) el mismo predio puede revisarse varias veces, también por la misma persona: cada intento es una fila
  r := public.registrar_revision('44444444-4444-4444-8444-444444444444', v_npn, 'confirmado', 'Ana', c, now(), null, null, null, null, null, 'Grupo 3', null);
  select count(*) into n from public.revisiones where npn = v_npn and revisor = 'Ana';
  informe := informe || case when n = 2 then 'ok repetidos se conservan; ' else 'FALLO: repetidos ' || n || '; ' end;
  -- 4) leer_revisiones no devuelve el contacto
  r := public.leer_revisiones(c);
  informe := informe || case when r::text !~ 'ana@correo.co' and r::text !~ 'contacto' then 'ok no filtra el contacto; ' else 'FALLO: filtra el contacto; ' end;
  -- 5) un contacto demasiado largo lo rechaza la restricción
  begin
    perform public.registrar_revision('55555555-5555-4555-8555-555555555555', v_npn, 'confirmado', 'Ana', c, now(), null, null, null, null, null, 'G', repeat('x', 121));
    informe := informe || 'FALLO: aceptó un contacto de 121 caracteres; ';
  exception when check_violation then
    informe := informe || 'ok rechaza contacto largo; ';
  end;
  raise exception 'INFORME: %', informe;
end $$;
