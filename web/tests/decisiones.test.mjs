// Opciones de decisión explícitas: «Hay error» / «Está OK» y los dos «no concluyente».
import assert from "node:assert/strict";
import test from "node:test";
import { CLAVES_FUENTE, DECISIONES, FUENTES, decisionActiva, decisionDeTecla, etiquetaDecision, etiquetaFuente } from "../src/decisiones.js";
import { desdeCsv } from "../src/revisiones.js";
import { ESTADOS } from "../src/validar.js";

const NPN = "410010102000000600014000000000";

test("las cuatro decisiones guardan solo estados que la base y las métricas ya conocen", () => {
  assert.deepEqual(DECISIONES.map((d) => d.t), ["Hay error – corregir", "Está OK – sin error", "Evidencia insuficiente", "No se pudo ubicar"]);
  for (const d of DECISIONES) assert.ok(ESTADOS.includes(d.k), d.k);
  assert.deepEqual(DECISIONES.map((d) => d.tecla), ["C", "D", "N", "U"]);
  assert.equal(new Set(DECISIONES.map((d) => d.tecla)).size, 4, "atajos distintos");
});

test("el atajo U es «no se pudo ubicar» y N «evidencia insuficiente»", () => {
  assert.equal(decisionDeTecla("u").motivo, "no_ubicado");
  assert.equal(decisionDeTecla("n").motivo, "insuficiente");
  assert.equal(decisionDeTecla("c").k, "confirmado");
  assert.equal(decisionDeTecla("x"), undefined);
});

test("la decisión activa distingue los dos «no concluyente» por su motivo", () => {
  assert.equal(decisionActiva({ estado: "no_concluyente", motivo: "no_ubicado" }).t, "No se pudo ubicar");
  assert.equal(decisionActiva({ estado: "no_concluyente", motivo: "insuficiente" }).t, "Evidencia insuficiente");
  assert.equal(decisionActiva({ estado: "confirmado" }).t, "Hay error – corregir");
  assert.equal(decisionActiva(undefined), undefined);
  assert.equal(etiquetaDecision({ estado: "no_concluyente" }), "No concluyente", "una revisión anterior a los motivos conserva su nombre");
  assert.equal(etiquetaDecision(null), "");
});

test("la fuente con error es opcional y tiene cuatro valores", () => {
  assert.deepEqual(CLAVES_FUENTE, ["registro", "cartografia", "imagen", "ninguna"]);
  assert.equal(etiquetaFuente("ninguna"), "Todas coinciden");
  assert.equal(etiquetaFuente("x"), "");
  assert.equal(FUENTES.length, 4);
});

test("al importar un CSV se leen motivo y fuente solo si son válidos", () => {
  const csv = [
    "npn,estado,motivo,fuente_error",
    `${NPN},no_concluyente,no_ubicado,cartografia`,
    `${"5".repeat(30)},confirmado,no_ubicado,registro`,
    `${"6".repeat(30)},descartado,,otra`,
  ].join("\n");
  const r = desdeCsv(csv);
  assert.deepEqual([r[NPN].motivo, r[NPN].fuente], ["no_ubicado", "cartografia"]);
  assert.equal(r["5".repeat(30)].motivo, undefined, "el motivo solo va con no concluyente");
  assert.equal(r["5".repeat(30)].fuente, "registro");
  assert.equal(r["6".repeat(30)].fuente, undefined, "una fuente desconocida se descarta");
});
