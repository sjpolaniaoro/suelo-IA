// Quién revisa: validación de la barra de identidad, envío con grupo y contacto, y respaldo sin la migración 0005.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { conNube, esFuncionario, identificado, normalizarPerfil, validarIdentidad } from "../src/identidad.js";
import { ErrorNube, enviarNube, leerEquipoNube, ratificarNube, reiniciarRespaldo, revisorPlano } from "../src/nube.js";

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");

test("el invitado solo necesita nombre; el funcionario, equipo y código; el contacto es opcional", () => {
  const inv = validarIdentidad({ nombre: "  Ana   Pérez ", rol: "invitado", equipo: "testing", contacto: "ana@correo.co", codigo: "x" });
  assert.deepEqual(inv.valores, { nombre: "Ana Pérez", rol: "invitado", equipo: "", grupo: "Invitado", contacto: "" }, "el invitado no deja contacto ni equipo");
  const fun = validarIdentidad({ nombre: "Ana", rol: "funcionario", equipo: "testing", contacto: "+57 300 123 4567", codigo: "abc" });
  assert.deepEqual(fun.valores, { nombre: "Ana", rol: "funcionario", equipo: "testing", grupo: "testing", contacto: "+57 300 123 4567" });
  assert.ok(validarIdentidad({ nombre: "A", rol: "invitado" }).error, "nombre de 1 letra");
  assert.ok(validarIdentidad({ nombre: "x".repeat(61), rol: "invitado" }).error, "nombre largo");
  assert.ok(validarIdentidad({ nombre: "Ana", rol: "" }).error, "sin elegir rol");
  assert.ok(validarIdentidad({ nombre: "Ana", rol: "funcionario", equipo: "", codigo: "abc" }).error, "funcionario sin equipo");
  assert.ok(validarIdentidad({ nombre: "Ana", rol: "funcionario", equipo: "otro", codigo: "abc" }).error, "equipo que no existe");
  assert.ok(validarIdentidad({ nombre: "Ana", rol: "funcionario", equipo: "testing", codigo: "  " }).error, "funcionario sin código");
  assert.ok(validarIdentidad({ nombre: "Ana", rol: "funcionario", equipo: "testing", codigo: "c", contacto: "ana@" }).error, "correo incompleto");
  assert.ok(validarIdentidad({ nombre: "Ana", rol: "funcionario", equipo: "testing", codigo: "c", contacto: "=HYPERLINK(1)" }).error, "fórmula como contacto");
});

test("los perfiles anteriores a los roles se normalizan: con código, funcionario de testing; sin código, invitado", () => {
  assert.equal(normalizarPerfil(null), null);
  assert.deepEqual(normalizarPerfil({ nombre: "Ana", grupo: "Grupo 3", codigo: "c" }), { nombre: "Ana", grupo: "testing", codigo: "c", rol: "funcionario", equipo: "testing" });
  const inv = normalizarPerfil({ nombre: "Luis", grupo: "Grupo 4", contacto: "x@y.co", codigo: "" });
  assert.equal(inv.rol, "invitado");
  assert.equal(inv.grupo, "Invitado");
  assert.equal(inv.contacto, "", "un invitado no deja contacto");
  const ya = { nombre: "Ana", rol: "invitado", grupo: "Invitado" };
  assert.equal(normalizarPerfil(ya), ya, "un perfil con rol no se toca");
});

test("quién envía y quién lee: el invitado envía sin código; solo el funcionario con código lee", () => {
  const inv = { nombre: "Luis", rol: "invitado", grupo: "Invitado" };
  const fun = { nombre: "Ana", rol: "funcionario", grupo: "testing", codigo: "c" };
  assert.equal(conNube(inv), true);
  assert.equal(esFuncionario(inv), false);
  assert.equal(conNube(fun), true);
  assert.equal(esFuncionario(fun), true);
  assert.equal(conNube({ nombre: "Ana", rol: "funcionario", grupo: "testing", codigo: "" }), false, "funcionario sin código no envía");
  assert.equal(conNube(null), false);
});

test("solo se identifica quien tiene nombre y grupo", () => {
  assert.equal(identificado(null), false);
  assert.equal(identificado({ nombre: "Ana", codigo: "x" }), false, "perfil anterior sin grupo");
  assert.equal(identificado({ nombre: "Ana", grupo: "G" }), true);
});

const evento = { id: "11111111-1111-4111-8111-111111111111", npn: "4".repeat(30), estado: "confirmado", fecha: "2026-10-30T08:00:00.000Z", revisor: "Ana Pérez", grupo: "Grupo 3", contacto: "ana@correo.co", puntaje: 62 };

async function conServidor(responder, fn) {
  const original = globalThis.fetch;
  const cuerpos = [];
  globalThis.fetch = async (url, init) => {
    const cuerpo = JSON.parse(init.body);
    cuerpos.push(cuerpo);
    return responder(cuerpo);
  };
  reiniciarRespaldo();
  try {
    await fn(cuerpos);
  } finally {
    globalThis.fetch = original;
    reiniciarRespaldo();
  }
}
const json = (status, cuerpo) => new Response(JSON.stringify(cuerpo), { status });

test("enviarNube manda nombre, grupo, contacto y la fecha de la decisión", async () => {
  await conServidor(() => json(200, { ok: true, id: evento.id, nueva: true }), async (cuerpos) => {
    await enviarNube(evento, "codigo");
    assert.equal(cuerpos.length, 1);
    assert.equal(cuerpos[0].p_revisor, "Ana Pérez");
    assert.equal(cuerpos[0].p_grupo, "Grupo 3");
    assert.equal(cuerpos[0].p_contacto, "ana@correo.co");
    assert.equal(cuerpos[0].p_fecha, evento.fecha);
  });
});

test("sin las migraciones 0005 y 0006 reenvía con el grupo dentro del nombre y recuerda el respaldo", async () => {
  await conServidor((c) => ("p_grupo" in c ? json(404, { code: "PGRST202" }) : json(200, { ok: true, nueva: true })), async (cuerpos) => {
    await enviarNube(evento, "codigo");
    assert.equal(cuerpos.length, 3, "primero las funciones nuevas, luego las de la 0005 y al final las anteriores");
    assert.ok(!("p_grupo" in cuerpos[2]) && !("p_contacto" in cuerpos[2]), "el respaldo usa la firma anterior");
    assert.equal(cuerpos[2].p_revisor, "Ana Pérez (Grupo 3)");
    await enviarNube(evento, "codigo");
    assert.equal(cuerpos.length, 4, "la segunda vez va directo al respaldo");
  });
});

test("con la 0005 pero sin la 0006 usa la función con grupo", async () => {
  await conServidor((c) => ("p_motivo" in c ? json(404, {}) : json(200, { ok: true, nueva: true })), async (cuerpos) => {
    await enviarNube(evento, "codigo");
    assert.equal(cuerpos.length, 2);
    assert.equal(cuerpos[1].p_grupo, "Grupo 3");
    assert.ok(!("p_motivo" in cuerpos[1]));
  });
});

test("otros errores de configuración o de red no activan el respaldo", async () => {
  await conServidor(() => json(401, {}), async (cuerpos) => {
    await assert.rejects(() => enviarNube(evento, "codigo"), (e) => e instanceof ErrorNube && e.tipo === "config");
    assert.equal(cuerpos.length, 1);
  });
  await conServidor(() => json(503, {}), async (cuerpos) => {
    await assert.rejects(() => enviarNube(evento, "codigo"), (e) => e.tipo === "red");
    assert.equal(cuerpos.length, 1);
  });
});

test("el revisor plano respeta el límite de 60 caracteres de la base", () => {
  const r = revisorPlano({ revisor: "N".repeat(60), grupo: "G".repeat(60) });
  assert.ok(r.length <= 60);
  assert.ok(r.endsWith(")"));
  assert.equal(revisorPlano({ revisor: "Ana", grupo: "" }), "Ana");
});

test("la migración 0005 guarda grupo y contacto sin devolver el contacto ni tocar creada_en", () => {
  const sql = leer("../../db/migrations/0005_grupo_y_contacto.sql");
  assert.match(sql, /add column grupo text/);
  assert.match(sql, /add column contacto text/);
  assert.match(sql, /grant execute on function public\.registrar_revision\([^)]*text, text\)\s+to anon/);
  assert.ok(!/leer_revisiones/.test(sql.replace(/--.*$/gm, "")), "la migración no cambia lo que devuelve leer_revisiones");
  assert.ok(!/creada_en/.test(sql.replace(/--.*$/gm, "")), "creada_en (hora de recepción) no se modifica");
  const base = leer("../../db/migrations/0001_revisiones.sql");
  assert.match(base, /creada_en timestamptz not null default now\(\)/);
});

test("enviarNube manda motivo y fuente con error, y sin código el invitado va con p_codigo nulo", async () => {
  await conServidor(() => json(200, { ok: true, nueva: true, rol: "invitado" }), async (cuerpos) => {
    await enviarNube({ ...evento, estado: "no_concluyente", motivo: "no_ubicado", fuente: "cartografia", grupo: "Invitado", contacto: null }, "");
    assert.equal(cuerpos[0].p_codigo, null);
    assert.equal(cuerpos[0].p_motivo, "no_ubicado");
    assert.equal(cuerpos[0].p_fuente_error, "cartografia");
    assert.equal(cuerpos[0].p_grupo, "Invitado");
    await enviarNube({ ...evento, motivo: null, fuente: null }, "codigo");
    assert.equal(cuerpos[1].p_codigo, "codigo");
    assert.equal(cuerpos[1].p_motivo, null);
  });
});

test("un invitado no puede enviar si la base aún no tiene la 0006", async () => {
  await conServidor(() => json(404, {}), async (cuerpos) => {
    await assert.rejects(() => enviarNube(evento, ""), (e) => e instanceof ErrorNube && e.tipo === "config");
    assert.equal(cuerpos.length, 1, "no cae a funciones que exigen código");
  });
});

test("el tope de envíos de invitado es un error propio y no descarta el evento", async () => {
  await conServidor(() => json(200, { ok: false, error: "demasiados_envios" }), async () => {
    await assert.rejects(() => enviarNube(evento, ""), (e) => e instanceof ErrorNube && e.tipo === "limite");
  });
});

test("leerEquipoNube trae el equipo y las revisiones; sin la 0006 usa la lectura anterior", async () => {
  await conServidor(() => json(200, { ok: true, equipo: "testing", es_prueba: true, filas: [{ npn: evento.npn, estado: "confirmado", rol: "invitado", id: evento.id }] }), async (cuerpos) => {
    const r = await leerEquipoNube("codigo");
    assert.equal(r.equipo, "testing");
    assert.equal(r.esPrueba, true);
    assert.equal(r.filas[0].rol, "invitado");
    assert.deepEqual(Object.keys(cuerpos[0]), ["p_codigo"]);
  });
  await conServidor(() => json(404, {}), async () => {
    await assert.rejects(() => leerEquipoNube("codigo"), (e) => e.tipo === "config");
  });
  const original = globalThis.fetch;
  const llamadas = [];
  globalThis.fetch = async (url) => {
    llamadas.push(String(url));
    return String(url).includes("leer_revisiones_v2") ? json(404, {}) : json(200, { ok: true, filas: [{ npn: evento.npn, estado: "descartado" }] });
  };
  reiniciarRespaldo();
  try {
    const r = await leerEquipoNube("codigo");
    assert.equal(r.equipo, null);
    assert.equal(r.filas.length, 1);
    assert.equal(llamadas.length, 2);
  } finally {
    globalThis.fetch = original;
    reiniciarRespaldo();
  }
});

test("ratificarNube manda el id de la revisión, el código y quién ratifica", async () => {
  await conServidor(() => json(200, { ok: true, nueva: true }), async (cuerpos) => {
    await ratificarNube(evento.id, "codigo", "Ana Pérez");
    assert.equal(cuerpos[0].p_id, evento.id);
    assert.equal(cuerpos[0].p_codigo, "codigo");
    assert.equal(cuerpos[0].p_revisor, "Ana Pérez");
    assert.match(cuerpos[0].p_ratificacion_id, /^[0-9a-f-]{36}$/);
  });
});

test("la migración 0006 deja al servidor decidir el rol, limita a invitados y no los deja leer", () => {
  const sql = leer("../../db/migrations/0006_roles_y_decisiones.sql").replace(/--.*$/gm, "");
  assert.match(sql, /create table public\.equipos/);
  assert.match(sql, /insert into public\.equipos[^;]*select 'testing', codigo_hash, true from public\.equipo_codigo/s, "el código vigente pasa al equipo testing, sin valores en el repositorio");
  assert.match(sql, /contar_envio_invitado/);
  assert.match(sql, /v_rol := 'invitado'/);
  assert.match(sql, /create view public\.revisiones_validas with \(security_invoker = true\)/);
  assert.match(sql, /grant execute on function public\.leer_revisiones_v2\(text\) to anon/);
  assert.ok(!/crypt\(\s*'[^']+'/.test(sql), "ningún código de equipo escrito en la migración");
});
