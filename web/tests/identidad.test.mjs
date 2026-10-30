// Quién revisa: validación de la barra de identidad, envío con grupo y contacto, y respaldo sin la migración 0005.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { identificado, validarIdentidad } from "../src/identidad.js";
import { ErrorNube, enviarNube, reiniciarRespaldo, revisorPlano } from "../src/nube.js";

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");

test("nombre y grupo son obligatorios; el contacto es opcional y debe ser correo o teléfono", () => {
  const ok = validarIdentidad({ nombre: "  Ana   Pérez ", grupo: " Grupo 3 ", contacto: "" });
  assert.deepEqual(ok.valores, { nombre: "Ana Pérez", grupo: "Grupo 3", contacto: "" });
  assert.ok(validarIdentidad({ nombre: "A", grupo: "G", contacto: "" }).error, "nombre de 1 letra");
  assert.ok(validarIdentidad({ nombre: "Ana", grupo: "  ", contacto: "" }).error, "grupo vacío");
  assert.ok(validarIdentidad({ nombre: "x".repeat(61), grupo: "G", contacto: "" }).error, "nombre largo");
  assert.ok(validarIdentidad({ nombre: "Ana", grupo: "G", contacto: "ana@correo.co" }).valores, "correo");
  assert.ok(validarIdentidad({ nombre: "Ana", grupo: "G", contacto: "+57 300 123 4567" }).valores, "teléfono");
  assert.ok(validarIdentidad({ nombre: "Ana", grupo: "G", contacto: "ana@" }).error, "correo incompleto");
  assert.ok(validarIdentidad({ nombre: "Ana", grupo: "G", contacto: "=HYPERLINK(1)" }).error, "fórmula como contacto");
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

test("sin la migración 0005 (404) reenvía con el grupo dentro del nombre y recuerda el respaldo", async () => {
  await conServidor((c) => ("p_grupo" in c ? json(404, { code: "PGRST202" }) : json(200, { ok: true, nueva: true })), async (cuerpos) => {
    await enviarNube(evento, "codigo");
    assert.equal(cuerpos.length, 2);
    assert.ok(!("p_grupo" in cuerpos[1]) && !("p_contacto" in cuerpos[1]), "el respaldo usa la firma anterior");
    assert.equal(cuerpos[1].p_revisor, "Ana Pérez (Grupo 3)");
    await enviarNube(evento, "codigo");
    assert.equal(cuerpos.length, 3, "la segunda vez va directo al respaldo");
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
