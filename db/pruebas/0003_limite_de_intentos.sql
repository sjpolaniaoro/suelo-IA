-- Pruebas de 0003_limite_de_intentos.sql. Se ejecutan DESPUÉS de aplicar la migración y terminan con un
-- RAISE EXCEPTION que revierte todo: no dejan filas (la tabla de revisiones es de solo anexar).
-- Requiere la fila de equipo_codigo; sustituye CODIGO_REAL por el código vigente al correrla.
do $$
declare
  c text := 'CODIGO_REAL';
  r jsonb;
  n integer;
  informe text := '';
  v_npn text := '410010102000000600014000000000';
begin
  perform set_config('request.headers', '{"cf-connecting-ip":"1.2.3.4"}', true);
  -- 1) cuatro fallos: siguen siendo codigo_invalido
  for n in 1..4 loop
    r := public.leer_revisiones('MAL');
    if r->>'error' <> 'codigo_invalido' then informe := informe || 'FALLO: intento ' || n || ' dio ' || (r->>'error') || '; '; end if;
  end loop;
  informe := informe || 'ok 4 fallos sin bloqueo; ';
  -- 2) el quinto fallo lo cuenta y bloquea; el sexto ya no ejecuta crypt
  r := public.leer_revisiones('MAL');
  informe := informe || 'quinto=' || (r->>'error') || '; ';
  r := public.leer_revisiones('MAL');
  informe := informe || case when r->>'error' = 'demasiados_intentos' then 'ok sexto bloqueado; ' else 'FALLO: sexto ' || coalesce(r->>'error','?') || '; ' end;
  -- 3) con el código correcto, durante el bloqueo, tampoco entra
  r := public.leer_revisiones(c);
  informe := informe || case when r->>'error' = 'demasiados_intentos' then 'ok código correcto bloqueado; ' else 'FALLO: entró bloqueado; ' end;
  r := public.registrar_revision(gen_random_uuid(), v_npn, 'confirmado', 'Ana', c, now());
  informe := informe || case when (r->>'ok')::boolean is false and r->>'error' = 'demasiados_intentos' then 'ok registrar bloqueado; ' else 'FALLO: registrar entró; ' end;
  -- 4) otro cliente con el código correcto entra y escribe
  perform set_config('request.headers', '{"cf-connecting-ip":"5.6.7.8"}', true);
  r := public.registrar_revision('11111111-1111-4111-8111-111111111111', v_npn, 'confirmado', ' Ana ', c, now(), 70, 'A1', 'dos_fuentes', 'oficina', 'v');
  informe := informe || case when (r->>'ok')::boolean and (r->>'nueva')::boolean then 'ok otro cliente escribe; ' else 'FALLO: otro cliente no escribió; ' end;
  r := public.registrar_revision('11111111-1111-4111-8111-111111111111', v_npn, 'confirmado', 'Ana', c, now());
  informe := informe || case when (r->>'ok')::boolean and not (r->>'nueva')::boolean then 'ok reintento idempotente; ' else 'FALLO: reintento duplicó; ' end;
  r := public.leer_revisiones(c);
  informe := informe || 'lee ' || jsonb_array_length(r->'filas') || ' fila(s); ';
  -- 5) al vencer el bloqueo del primer cliente, el código correcto entra y limpia el contador
  update public.intentos_codigo set bloqueado_hasta = now() - interval '1 second' where clave = 'ip:1.2.3.4';
  perform set_config('request.headers', '{"cf-connecting-ip":"1.2.3.4"}', true);
  r := public.leer_revisiones(c);
  select count(*) into n from public.intentos_codigo where clave = 'ip:1.2.3.4';
  informe := informe || case when (r->>'ok')::boolean and n = 0 then 'ok tras vencer entra y se limpia; ' else 'FALLO: no se limpió; ' end;
  -- 6) respaldo global: 40 fallos desde 40 clientes distintos bloquean a todos
  for n in 1..40 loop
    perform set_config('request.headers', json_build_object('cf-connecting-ip', '9.9.9.' || n)::text, true);
    perform public.leer_revisiones('MAL');
  end loop;
  perform set_config('request.headers', '{"cf-connecting-ip":"5.6.7.8"}', true);
  r := public.leer_revisiones(c);
  informe := informe || case when r->>'error' = 'demasiados_intentos' then 'ok bloqueo global; ' else 'FALLO: sin bloqueo global; ' end;
  -- 7) sigue cerrado el acceso directo y el solo anexar
  begin update public.revisiones set estado = 'descartado'; informe := informe || 'FALLO: update; ';
  exception when others then informe := informe || 'ok update bloqueado; '; end;
  raise exception 'RESULTADO: %', informe;
end $$;
