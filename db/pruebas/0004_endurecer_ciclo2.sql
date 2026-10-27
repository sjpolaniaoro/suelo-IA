-- Pruebas de 0004_endurecer_ciclo2.sql. Se ejecutan DESPUÉS de aplicar la migración y terminan con un
-- RAISE EXCEPTION que revierte todo: no dejan filas (la tabla de revisiones es de solo anexar).
-- Sustituye CODIGO_REAL por el código de equipo vigente al correrla; el código no se guarda en el repositorio.
do $$
declare
  c text := 'CODIGO_REAL';
  r jsonb;
  n integer;
  informe text := '';
  v_npn text := '410010102000000600014000000000';
  v_bloq timestamptz;
begin
  -- 1) fecha_cliente acotada
  perform set_config('request.headers', '{"cf-connecting-ip":"1.2.3.4"}', true);
  r := public.registrar_revision('11111111-1111-4111-8111-111111111111', v_npn, 'confirmado', 'Ana', c, now() + interval '1 year');
  informe := informe || case when r->>'error' = 'fecha_invalida' then 'ok fecha futura rechazada; ' else 'FALLO: fecha futura; ' end;
  r := public.registrar_revision('22222222-2222-4222-8222-222222222222', v_npn, 'confirmado', 'Ana', c, 'infinity'::timestamptz);
  informe := informe || case when r->>'error' = 'fecha_invalida' then 'ok infinity rechazada; ' else 'FALLO: infinity; ' end;
  r := public.registrar_revision('33333333-3333-4333-8333-333333333333', v_npn, 'confirmado', 'Ana', c, timestamptz '2019-01-01');
  informe := informe || case when r->>'error' = 'fecha_invalida' then 'ok fecha anterior a 2020 rechazada; ' else 'FALLO: 2019; ' end;
  r := public.registrar_revision('44444444-4444-4444-8444-444444444444', v_npn, 'confirmado', 'Ana', c, now() + interval '1 hour');
  informe := informe || case when (r->>'ok')::boolean and (r->>'nueva')::boolean then 'ok una hora de tolerancia entra; ' else 'FALLO: tolerancia; ' end;
  r := public.registrar_revision('55555555-5555-4555-8555-555555555555', v_npn, 'descartado', 'Luis', c, now());
  informe := informe || case when (r->>'ok')::boolean then 'ok fecha actual entra; ' else 'FALLO: fecha actual; ' end;

  -- 2) IPv6 agrupada por /64: cinco fallos repartidos entre dos direcciones del mismo /64 bloquean a una tercera
  for n in 1..3 loop
    perform set_config('request.headers', '{"cf-connecting-ip":"2001:db8:1:2:aaaa::1"}', true);
    perform public.leer_revisiones('MAL');
  end loop;
  for n in 1..2 loop
    perform set_config('request.headers', '{"cf-connecting-ip":"2001:db8:1:2:bbbb::2"}', true);
    perform public.leer_revisiones('MAL');
  end loop;
  select count(*) into n from public.intentos_codigo where clave = 'ip:2001:db8:1:2::';
  informe := informe || case when n = 1 then 'ok IPv6 agrupada por /64; ' else 'FALLO: IPv6 sin agrupar; ' end;
  perform set_config('request.headers', '{"cf-connecting-ip":"2001:db8:1:2:cccc::3"}', true);
  r := public.leer_revisiones(c);
  informe := informe || case when r->>'error' = 'demasiados_intentos' then 'ok tercer vecino del /64 bloqueado; ' else 'FALLO: /64 no bloqueó; ' end;

  -- 3) un valor que no es IP no rompe la función
  perform set_config('request.headers', '{"cf-connecting-ip":"no-es-ip"}', true);
  r := public.leer_revisiones('MAL');
  informe := informe || case when r->>'error' = 'codigo_invalido' then 'ok valor no IP no rompe; ' else 'FALLO: valor no IP; ' end;

  -- 4) exponente acotado: 80 fallos no desbordan el intervalo
  insert into public.intentos_codigo (clave, fallos, ultimo) values ('ip:prueba', 80, now());
  perform public.registrar_fallo('ip:prueba', 5, 30);
  select bloqueado_hasta into v_bloq from public.intentos_codigo where clave = 'ip:prueba';
  informe := informe || case when v_bloq is not null and v_bloq <= now() + interval '1 hour 1 second' then 'ok exponente acotado; ' else 'FALLO: exponente; ' end;

  -- 5) search_path vacío y privilegios intactos
  select count(*) into n from pg_proc p where p.pronamespace = 'public'::regnamespace
    and p.proname in ('registrar_fallo', 'codigo_valido', 'verificar_codigo', 'registrar_revision', 'leer_revisiones')
    and 'search_path=""' = any(p.proconfig);
  informe := informe || case when n = 5 then 'ok 5 funciones con search_path vacío; ' else 'FALLO: search_path; ' end;
  informe := informe || case when has_function_privilege('anon', 'public.registrar_revision(uuid,text,text,text,text,timestamptz,integer,text,text,text,text)', 'execute')
    and has_function_privilege('anon', 'public.leer_revisiones(text)', 'execute')
    and not has_function_privilege('anon', 'public.verificar_codigo(text)', 'execute')
    and not has_function_privilege('anon', 'public.codigo_valido(text)', 'execute')
    and not has_function_privilege('anon', 'public.registrar_fallo(text,integer,integer)', 'execute')
    then 'ok privilegios intactos; ' else 'FALLO: privilegios; ' end;
  raise exception 'RESULTADO: %', informe;
end $$;
