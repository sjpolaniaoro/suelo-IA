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

import { hayCambio, seleccionActual } from "../src/decisiones.js";

test("elegir una decisión es un borrador: sin revisión enviada, hay algo por enviar solo si se eligió", () => {
  assert.deepEqual(seleccionActual(undefined, {}), { estado: null, motivo: null, fuente: null });
  assert.equal(hayCambio(undefined, seleccionActual(undefined, {})), false, "sin decisión no se puede enviar");
  const sel = seleccionActual(undefined, { estado: "confirmado", motivo: null });
  assert.equal(sel.estado, "confirmado");
  assert.equal(hayCambio(undefined, sel), true);
});

test("el borrador solo pisa lo que se tocó; el resto viene de la revisión ya enviada", () => {
  const enviada = { estado: "descartado", fuente: "registro" };
  assert.equal(hayCambio(enviada, seleccionActual(enviada, {})), false, "sin cambios no hay nada por enviar");
  const soloFuente = seleccionActual(enviada, { fuente: "imagen" });
  assert.deepEqual(soloFuente, { estado: "descartado", motivo: null, fuente: "imagen" });
  assert.equal(hayCambio(enviada, soloFuente), true);
  const quitarFuente = seleccionActual(enviada, { fuente: null });
  assert.equal(quitarFuente.fuente, null, "se puede dejar la fuente vacía");
  assert.equal(hayCambio(enviada, quitarFuente), true);
  const otra = seleccionActual(enviada, { estado: "confirmado", motivo: null });
  assert.deepEqual(otra, { estado: "confirmado", motivo: null, fuente: "registro" }, "la fuente ya enviada se conserva");
});

test("el motivo solo acompaña a «no concluyente»", () => {
  const nc = seleccionActual(undefined, { estado: "no_concluyente", motivo: "no_ubicado" });
  assert.equal(nc.motivo, "no_ubicado");
  const err = seleccionActual({ estado: "no_concluyente", motivo: "insuficiente" }, { estado: "confirmado", motivo: "insuficiente" });
  assert.equal(err.motivo, null, "al pasar a «Hay error» el motivo anterior se descarta");
  assert.equal(hayCambio({ estado: "no_concluyente", motivo: "insuficiente" }, seleccionActual({ estado: "no_concluyente", motivo: "insuficiente" }, { estado: "no_concluyente", motivo: "no_ubicado" })), true, "cambiar de motivo es un cambio");
});
