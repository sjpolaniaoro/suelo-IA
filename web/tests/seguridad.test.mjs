// Pruebas de los arreglos de la auditoría de seguridad (corrida 1). Se ejecutan con `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ErrorNube, interpretar } from "../src/nube.js";
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
