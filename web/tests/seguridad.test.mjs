// Pruebas de los arreglos de la auditoría de seguridad (corrida 1). Se ejecutan con `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ErrorNube, interpretar, leerNube } from "../src/nube.js";
import { aCsv, desdeCsv } from "../src/revisiones.js";
import { textoTooltip } from "../src/tooltip.js";
import { validarGeojson } from "../src/validar.js";

const NPN = "410010102000000600014000000000";
const fc = (props, geometry = null) => ({ type: "FeatureCollection", features: [{ type: "Feature", geometry, properties: { npn: NPN, ...props } }] });

/* ---------- Tooltip: texto plano ---------- */
test("el tooltip devuelve texto y no interpreta etiquetas de la dirección", () => {
  const t = textoTooltip({ npn: NPN, direccion: "<img src=x onerror=window.__x=1>", puntaje: 70, nivel: "rojo", accion: "oficina" });
  assert.equal(typeof t, "string");
  assert.ok(t.startsWith("<img src=x onerror=window.__x=1>"), "el valor queda literal");
  assert.match(t, /Prioridad alta · puntaje 70/);
  assert.match(t, /Conciliar en oficina/);
});

test("Mapa.jsx no vuelve a devolver html en el tooltip", () => {
  const fuente = readFileSync(new URL("../src/Mapa.jsx", import.meta.url), "utf8");
  const inicio = fuente.indexOf("getTooltip:");
  const tooltip = fuente.slice(inicio, inicio + 600).replace(/\/\/.*$/gm, ""); // sin comentarios
  assert.ok(!/\bhtml\s*:/.test(tooltip), "getTooltip debe usar text, no html");
  assert.match(tooltip, /text\s*:\s*textoTooltip/);
});

/* ---------- Importación de GeoJSON ---------- */
test("el GeoJSON real del sector pasa la validación", () => {
  const real = JSON.parse(readFileSync(new URL("../public/data/sector02.geojson", import.meta.url), "utf8"));
  assert.doesNotThrow(() => validarGeojson(real));
});

test("la validación rechaza propiedades con tipos o valores inesperados", () => {
  assert.doesNotThrow(() => validarGeojson(fc({ direccion: "K 4 21 115", puntaje: 70, nivel: "rojo", accion: "campo" })));
  const malos = [
    { npn: "123" },
    { direccion: 5 },
    { direccion: "x".repeat(121) },
    { puntaje: "70" },
    { puntaje: 101 },
    { nivel: "<img src=x>" },
    { accion: "hackear" },
    { triangulacion: "otra" },
    { A1: "si" },
    { area_huella: "10" },
    { razones: "una razón" },
    { razones: Array(21).fill("x") },
  ];
  for (const m of malos) assert.throws(() => validarGeojson(fc(m)), /Predio 1/, JSON.stringify(m));
  assert.throws(() => validarGeojson(fc({}, { type: "Point", coordinates: [0, 0] })), /polígono/);
  assert.throws(() => validarGeojson({ type: "FeatureCollection", features: [] }), /no trae predios/);
  assert.throws(() => validarGeojson({ type: "Feature" }), /FeatureCollection/);
});

/* ---------- CSV: fórmulas y reimportación ---------- */
test("aCsv antepone una comilla a las celdas de texto que una hoja evaluaría como fórmula", () => {
  const filas = [
    { revisor: "=1+1" },
    { revisor: "+cmd" },
    { revisor: "-2+3" },
    { revisor: "@SUM(A1)" },
    { revisor: "\t=1" },
    { revisor: '=HYPERLINK("http://example.invalid","x")' },
    { revisor: "Ana Pérez" },
    { revisor: -5 },
  ];
  const lineas = aCsv(filas, [["revisor", "revisor"]]).split("\n").slice(1);
  assert.equal(lineas[0], `"'=1+1"`);
  assert.equal(lineas[1], `"'+cmd"`);
  assert.equal(lineas[2], `"'-2+3"`);
  assert.equal(lineas[3], `"'@SUM(A1)"`);
  assert.equal(lineas[4], `"'\t=1"`);
  assert.equal(lineas[5], `"'=HYPERLINK(""http://example.invalid"",""x"")"`);
  assert.equal(lineas[6], `"Ana Pérez"`, "un nombre normal no cambia");
  assert.equal(lineas[7], `"-5"`, "un número no se toca");
  for (const l of lineas.slice(0, 6)) assert.ok(!/^"[=+\-@\t\r]/.test(l), `la celda no debe empezar por un carácter de fórmula: ${l}`);
});

test("desdeCsv quita el prefijo al reimportar y descarta filas inválidas", () => {
  const csv = aCsv(
    [
      { npn: NPN, estado: "confirmado", fecha: "2026-10-27T10:00:00Z", revisor: "=1+1" },
      { npn: "1".repeat(30), estado: "inventado", fecha: "", revisor: "Luis" },
      { npn: "__proto__", estado: "confirmado", fecha: "", revisor: "Eva" },
      { npn: "2".repeat(30), estado: "descartado", fecha: "no es fecha", revisor: "Zoe" },
    ],
    [["npn", "npn"], ["estado", "estado"], ["fecha", "fecha"], ["revisor", "revisor"]],
  );
  const r = desdeCsv(csv);
  assert.deepEqual(Object.keys(r).sort(), [NPN, "2".repeat(30)].sort());
  assert.equal(r[NPN].revisor, "=1+1", "ida y vuelta sin el prefijo");
  assert.equal(r["2".repeat(30)].fecha, "", "una fecha inválida se vacía");
  assert.equal(Object.getPrototypeOf(r), Object.prototype);
});

test("desdeCsv exige al menos una revisión válida", () => {
  assert.throws(() => desdeCsv("npn,estado\nabc,confirmado\n"), /no trae revisiones válidas/);
  assert.throws(() => desdeCsv("estado\nconfirmado\n"), /npn y estado/);
});

/* ---------- Respuestas del servidor (funciones nuevas y anteriores) ---------- */
test("interpretar acepta la forma anterior y entiende los errores de la nueva", () => {
  assert.deepEqual(interpretar([{ npn: NPN }]), [{ npn: NPN }]);
  assert.equal(interpretar("uuid"), "uuid");
  assert.deepEqual(interpretar({ ok: true, filas: [] }), { ok: true, filas: [] });
  assert.throws(() => interpretar({ ok: false, error: "codigo_invalido" }), (e) => e instanceof ErrorNube && e.tipo === "codigo");
  assert.throws(() => interpretar({ ok: false, error: "demasiados_intentos" }), (e) => e instanceof ErrorNube && e.tipo === "bloqueo");
  assert.throws(() => interpretar({ ok: false, error: "otro" }), (e) => e instanceof ErrorNube && e.tipo === "datos");
});

/* ---------- Ciclo 2: listas en el CSV, fechas e importación acotada ---------- */
test("aCsv también neutraliza las listas (razones)", () => {
  const lineas = aCsv([{ razones: ["=1+1"] }, { razones: ["+cmd", "x"] }, { razones: ["Huella de 90 m²", "otra"] }], [["razones", "razones"]]).split("\n").slice(1);
  assert.equal(lineas[0], `"'=1+1"`);
  assert.equal(lineas[1], `"'+cmd; x"`);
  assert.equal(lineas[2], `"Huella de 90 m²; otra"`, "una lista normal no cambia");
});

test("desdeCsv vacía las fechas fuera de rango, normaliza las válidas y marca el origen", () => {
  const futuro = new Date(Date.now() + 5 * 86400000).toISOString();
  const csv = aCsv(
    [
      { npn: NPN, estado: "confirmado", fecha: "2999-01-01", revisor: "A1" },
      { npn: "2".repeat(30), estado: "confirmado", fecha: futuro, revisor: "A2" },
      { npn: "3".repeat(30), estado: "descartado", fecha: "2019-12-31", revisor: "A3" },
      { npn: "4".repeat(30), estado: "descartado", fecha: "2026-10-27T10:00:00Z", revisor: "A4" },
    ],
    [["npn", "npn"], ["estado", "estado"], ["fecha", "fecha"], ["revisor", "revisor"]],
  );
  const r = desdeCsv(csv);
  assert.equal(r[NPN].fecha, "", "una fecha futura no puede fijar el estado");
  assert.equal(r["2".repeat(30)].fecha, "");
  assert.equal(r["3".repeat(30)].fecha, "", "anterior a 2020");
  assert.equal(r["4".repeat(30)].fecha, "2026-10-27T10:00:00.000Z");
  assert.ok(Object.values(r).every((x) => x.origen === "csv"), "lo importado queda marcado y no se sube solo");
});

test("desdeCsv rechaza archivos con demasiadas filas", () => {
  const filas = Array.from({ length: 50002 }, () => `${NPN},confirmado`).join("\n");
  assert.throws(() => desdeCsv(`npn,estado\n${filas}`), /más de 50000 filas/);
});

/* ---------- Errores del servidor: solo los de datos descartan el evento ---------- */
test("leerNube distingue errores de datos, de configuración, de red y de código", async () => {
  const original = globalThis.fetch;
  const responder = (status, cuerpo = {}) => async () => new Response(JSON.stringify(cuerpo), { status });
  try {
    for (const [status, cuerpo, tipo] of [
      [422, { message: "violación" }, "datos"],
      [400, { message: "check" }, "datos"],
      [401, {}, "config"],
      [403, {}, "config"],
      [404, {}, "config"],
      [503, {}, "red"],
      [429, {}, "red"],
      [403, { message: "codigo_invalido" }, "codigo"],
    ]) {
      globalThis.fetch = responder(status, cuerpo);
      await assert.rejects(() => leerNube("x"), (e) => e instanceof ErrorNube && e.tipo === tipo, `${status} -> ${tipo}`);
    }
    globalThis.fetch = async () => { throw new TypeError("sin red"); };
    await assert.rejects(() => leerNube("x"), (e) => e.tipo === "red");
  } finally {
    globalThis.fetch = original;
  }
});

test("los predios sin alerta se separan en OK, PH sin evaluar y solo cartografía", async () => {
  const { claseSinAlerta } = await import("../src/clases.js");
  assert.equal(claseSinAlerta({ puntaje: 0, ph: false, accion: null }), "ok");
  assert.equal(claseSinAlerta({ puntaje: 0, ph: true, accion: null }), "ph");
  assert.equal(claseSinAlerta({ puntaje: 0, ph: false, accion: "oficina" }), "cartografia");
  assert.equal(claseSinAlerta({ puntaje: 70, ph: false }), null);
  assert.equal(claseSinAlerta({ puntaje: 0, NR: true }), null);
});

test("tipo_hallazgo sigue el árbol de decisión", async () => {
  const { tipoHallazgo } = await import("../src/clases.js");
  const con = { puntaje: 70 }, sin = { puntaje: 0, ph: false };
  assert.equal(tipoHallazgo(con, "confirmado"), "acierto");
  assert.equal(tipoHallazgo(con, "descartado"), "falso_positivo");
  assert.equal(tipoHallazgo(sin, "confirmado"), "omision");
  assert.equal(tipoHallazgo(sin, "descartado"), "conforme");
  assert.equal(tipoHallazgo(con, "no_concluyente"), "no_concluyente");
  assert.equal(tipoHallazgo(sin, "no_concluyente"), "no_concluyente");
  assert.equal(tipoHallazgo({ puntaje: 0, NR: true }, "confirmado"), "acierto");
});

test("tipo_hallazgo: solo cartografía cuenta como alerta del sistema y propiedad horizontal queda fuera", async () => {
  const { tipoHallazgo, esAlertaDelSistema } = await import("../src/clases.js");
  const cart = { puntaje: 0, ph: false, accion: "oficina", triangulacion: "solo_cartografia" };
  assert.equal(esAlertaDelSistema(cart), true);
  assert.equal(tipoHallazgo(cart, "confirmado"), "acierto");
  assert.equal(tipoHallazgo(cart, "descartado"), "falso_positivo");
  const ph = { puntaje: 0, ph: true, accion: null };
  assert.equal(esAlertaDelSistema(ph), false);
  assert.equal(tipoHallazgo(ph, "confirmado"), "ph_sin_evaluar");
  assert.equal(tipoHallazgo(ph, "descartado"), "ph_sin_evaluar");
  assert.equal(tipoHallazgo(ph, "no_concluyente"), "no_concluyente");
  assert.equal(tipoHallazgo({ puntaje: 10, ph: true, A3: true }, "confirmado"), "acierto", "con alerta A3 la propiedad horizontal sí se mide");
  assert.equal(tipoHallazgo({ puntaje: 0, ph: false }, "otro"), "");
});

test("los filtros combinan prioridad, tipo y cola con «Sin prioridad» como valor nulo", async () => {
  const { pasaFiltros } = await import("../src/filtros.js");
  const alta = { puntaje: 70, nivel: "rojo", A1: true, accion: "oficina" };
  const ok = { puntaje: 0, nivel: "sin_alerta", ph: false, accion: null };
  const cart = { puntaje: 0, nivel: "sin_alerta", ph: false, accion: "oficina" };
  const nr = { puntaje: 0, NR: true, nivel: "no_residencial", accion: "campo" };
  const base = { tipo: "todas", accion: "todas", niveles: new Set(["rojo", "naranja", "amarillo"]), sinAlerta: new Set(["ok", "ph", "cartografia", "nr"]) };
  const con = { ...base, niveles: new Set([...base.niveles, "ninguna"]) };
  // sin «Sin prioridad» solo se ven las alertas de vivienda
  assert.ok(pasaFiltros(alta, base)); assert.ok(!pasaFiltros(ok, base)); assert.ok(!pasaFiltros(nr, base));
  // sin ningún filtro (todo encendido) se ve todo
  for (const p of [alta, ok, cart, nr, { puntaje: 0, ph: true }]) assert.ok(pasaFiltros(p, con));
  // con «Sin prioridad» entran los sin alerta y NR
  assert.ok(pasaFiltros(ok, con)); assert.ok(pasaFiltros(cart, con)); assert.ok(pasaFiltros(nr, con));
  // un tipo concreto deja fuera a los que no tienen tipo
  assert.ok(!pasaFiltros(ok, { ...con, tipo: "A1" })); assert.ok(!pasaFiltros(nr, { ...con, tipo: "A1" }));
  assert.ok(pasaFiltros(nr, { ...base, tipo: "NR" })); assert.ok(!pasaFiltros(alta, { ...base, tipo: "NR" }));
  // la cola aplica igual a todos, incluida «Sin cola»
  assert.ok(!pasaFiltros(ok, { ...con, accion: "oficina" })); assert.ok(pasaFiltros(cart, { ...con, accion: "oficina" }));
  assert.ok(pasaFiltros(ok, { ...con, accion: "ninguna" })); assert.ok(!pasaFiltros(alta, { ...con, accion: "ninguna" }));
  // «Ninguna» deja solo los predios sin alerta; excluye alertas y NR
  const ning = { ...con, tipo: "ninguna" };
  assert.ok(pasaFiltros(ok, ning)); assert.ok(pasaFiltros(cart, ning));
  assert.ok(!pasaFiltros(alta, ning)); assert.ok(!pasaFiltros(nr, ning));
  assert.ok(!pasaFiltros(ok, { ...base, tipo: "ninguna" })); // sin «Sin prioridad» encendido no hay nada
  // el detalle filtra las clases sin alerta
  assert.ok(!pasaFiltros(ok, { ...con, sinAlerta: new Set(["ph"]) }));
});
