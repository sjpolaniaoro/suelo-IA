-- Pruebas de 0006_roles_y_decisiones.sql. Se ejecutan DESPUÉS de aplicar la migración y terminan con un
-- RAISE EXCEPTION que revierte todo: no dejan filas (la tabla de revisiones es de solo anexar).
-- Sustituye CODIGO_REAL por el código vigente del equipo `testing` al correrla.
do $$
declare
  c text := 'CODIGO_REAL';
  otro text := 'CODIGO-OTRO-EQUIPO';
  r jsonb;
  f record;
  n integer;
  informe text := '';
  v_npn text := '410010102000000600014000000000';
  v_inv uuid := '22222222-2222-4222-8222-222222222222';
begin
  perform set_config('request.headers', '{"cf-connecting-ip":"10.0.0.1"}', true);
  insert into public.equipos (nombre, codigo_hash, es_prueba)
  values ('catastro', extensions.crypt(otro, extensions.gen_salt('bf')), false);

  -- 1) invitado: sin código escribe; el servidor fija rol, grupo y descarta el contacto
  r := public.registrar_revision_v2(v_inv, v_npn, 'confirmado', 'Visitante', null, now(), 70, 'A1', 'dos_fuentes', 'oficina', 'v',
                                    'Funcionario', 'a@b.co', null, 'registro');
  select * into f from public.revisiones where id = v_inv;
  informe := informe || case when (r->>'ok')::boolean and f.rol = 'invitado' and f.grupo = 'Invitado' and f.contacto is null
                                  and f.equipo is null and not f.es_prueba and f.fuente_error = 'registro'
                             then 'ok invitado escribe como invitado; ' else 'FALLO: invitado ' || r::text || '; ' end;
  -- 2) invitado no lee
  r := public.leer_revisiones_v2(null);
  informe := informe || case when r->>'error' = 'codigo_invalido' then 'ok invitado no lee; ' else 'FALLO: invitado leyó; ' end;
  -- 3) funcionario de prueba: rol, equipo y es_prueba salen del código, no del cliente
  r := public.registrar_revision_v2('33333333-3333-4333-8333-333333333333', v_npn, 'no_concluyente', 'Ana', c, now() + interval '1 minute',
                                    null, null, null, null, null, 'testing', null, 'no_ubicado', 'ninguna');
  select * into f from public.revisiones where id = '33333333-3333-4333-8333-333333333333';
  informe := informe || case when (r->>'ok')::boolean and f.rol = 'funcionario' and f.equipo = 'testing' and f.es_prueba and f.motivo = 'no_ubicado'
                             then 'ok funcionario testing; ' else 'FALLO: funcionario ' || r::text || '; ' end;
  -- 4) un código malo no se hace pasar por invitado
  r := public.registrar_revision_v2(gen_random_uuid(), v_npn, 'confirmado', 'Ana', 'MAL', now());
  informe := informe || case when r->>'error' = 'codigo_invalido' then 'ok código malo rechazado; ' else 'FALLO: código malo ' || r::text || '; ' end;
  -- 5) valores inválidos: motivo con otro estado y fuente desconocida
  begin
    perform public.registrar_revision_v2(gen_random_uuid(), v_npn, 'confirmado', 'Ana', c, now(), null, null, null, null, null, null, null, 'insuficiente', null);
    informe := informe || 'FALLO: motivo con confirmado; ';
  exception when others then informe := informe || 'ok motivo solo en no concluyente; '; end;
  begin
    perform public.registrar_revision_v2(gen_random_uuid(), v_npn, 'confirmado', 'Ana', c, now(), null, null, null, null, null, null, null, null, 'otra');
    informe := informe || 'FALLO: fuente inválida; ';
  exception when others then informe := informe || 'ok fuente inválida rechazada; '; end;
  -- 6) límite de envíos del invitado: 300 por cliente y por día
  update public.envios_invitado set n = 300 where clave = 'ip:10.0.0.1';
  r := public.registrar_revision_v2(gen_random_uuid(), v_npn, 'confirmado', 'Visitante', null, now());
  informe := informe || case when r->>'error' = 'demasiados_envios' then 'ok tope por cliente; ' else 'FALLO: sin tope ' || r::text || '; ' end;
  perform set_config('request.headers', '{"cf-connecting-ip":"10.0.0.2"}', true);
  r := public.registrar_revision_v2(gen_random_uuid(), v_npn, 'confirmado', 'Visitante', null, now());
  informe := informe || case when (r->>'ok')::boolean then 'ok otro cliente sigue; ' else 'FALLO: otro cliente ' || r::text || '; ' end;
  perform set_config('request.headers', '{"cf-connecting-ip":"10.0.0.1"}', true);
  -- 7) un equipo real no ve lo de prueba pero sí lo de invitados; el de prueba ve todo
  r := public.leer_revisiones_v2(otro);
  select count(*) into n from jsonb_array_elements(r->'filas');
  informe := informe || case when (r->>'ok')::boolean and (r->'filas'->0->>'rol') = 'invitado' and n = 1 and (r->>'equipo') = 'catastro'
                             then 'ok equipo real ve invitado y no prueba; ' else 'FALLO: lectura equipo real ' || r::text || '; ' end;
  r := public.leer_revisiones_v2(c);
  informe := informe || case when (r->>'ok')::boolean and (r->>'es_prueba')::boolean and (r->'filas'->0->>'rol') = 'funcionario'
                             then 'ok testing ve lo último; ' else 'FALLO: lectura testing ' || r::text || '; ' end;
  -- 8) métricas oficiales: ni lo de prueba ni lo de invitado sin ratificar
  select count(*) into n from public.revisiones_validas;
  informe := informe || case when n = 0 then 'ok vista válida vacía; ' else 'FALLO: vista válida ' || n || '; ' end;
  -- 9) ratificación: la de un equipo de prueba no cuenta; la de un equipo real sí; no ratifica lo de funcionarios
  r := public.ratificar_revision(v_inv, c, 'Ana', gen_random_uuid());
  select count(*) into n from public.revisiones_validas;
  informe := informe || case when (r->>'ok')::boolean and n = 0 then 'ok ratificar desde prueba no cuenta; ' else 'FALLO: ratificación prueba; ' end;
  r := public.ratificar_revision(v_inv, otro, 'Luis', gen_random_uuid());
  select count(*) into n from public.revisiones_validas;
  informe := informe || case when (r->>'ok')::boolean and n = 1 then 'ok ratificar desde equipo real cuenta; ' else 'FALLO: ratificación real; ' end;
  r := public.ratificar_revision('33333333-3333-4333-8333-333333333333', otro, 'Luis', gen_random_uuid());
  informe := informe || case when r->>'error' = 'no_es_de_invitado' then 'ok solo se ratifica a invitados; ' else 'FALLO: ratificó funcionario; ' end;
  -- 10) el cliente anterior sigue funcionando y queda como funcionario del equipo
  r := public.registrar_revision('44444444-4444-4444-8444-444444444444', v_npn, 'descartado', 'Ana', otro, now(), 10, 'A3', null, null, 'v', 'catastro', null);
  select * into f from public.revisiones where id = '44444444-4444-4444-8444-444444444444';
  informe := informe || case when (r->>'ok')::boolean and f.rol = 'funcionario' and f.equipo = 'catastro' and not f.es_prueba
                             then 'ok cliente anterior; ' else 'FALLO: cliente anterior ' || r::text || '; ' end;
  r := public.registrar_revision(gen_random_uuid(), v_npn, 'descartado', 'Ana', '', now());
  informe := informe || case when r->>'error' = 'codigo_invalido' then 'ok cliente anterior sin código no entra; ' else 'FALLO: anterior sin código; ' end;
  -- 11) acceso directo cerrado para anon y solo anexar
  set local role anon;
  begin perform 1 from public.revisiones limit 1; informe := informe || 'FALLO: anon lee revisiones; ';
  exception when insufficient_privilege then informe := informe || 'ok anon sin tablas; '; end;
  begin perform 1 from public.equipos limit 1; informe := informe || 'FALLO: anon lee equipos; ';
  exception when insufficient_privilege then informe := informe || 'ok anon sin equipos; '; end;
  begin perform 1 from public.revisiones_validas limit 1; informe := informe || 'FALLO: anon lee la vista; ';
  exception when insufficient_privilege then informe := informe || 'ok anon sin vista; '; end;
  reset role;
  begin update public.revisiones set estado = 'descartado'; informe := informe || 'FALLO: update; ';
  exception when others then informe := informe || 'ok update bloqueado; '; end;
  begin delete from public.ratificaciones; informe := informe || 'FALLO: delete ratificaciones; ';
  exception when others then informe := informe || 'ok ratificaciones solo anexar; '; end;
  raise exception 'RESULTADO: %', informe;
end $$;
