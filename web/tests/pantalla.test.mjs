// El diseño del mapa en celular: una sola definición de «pantalla de celular» y reglas que ganan por orden.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CONSULTA_APAISADO, CONSULTA_MOVIL } from "../src/pantalla.js";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("el CSS usa la misma consulta de celular que el JavaScript", () => {
  assert.ok(css.includes(`@media ${CONSULTA_MOVIL} {`), "falta la consulta combinada de celular");
  assert.ok(css.includes(`@media ${CONSULTA_APAISADO} {`), "falta la consulta de horizontal bajo");
});

test("las reglas de celular de la ficha van después del bloque de escritorio que las pisaba", () => {
  const escritorio = css.indexOf(".ficha-col {\n  position: relative;");
  const celular = css.indexOf(`@media ${CONSULTA_MOVIL} {\n  .cuerpo {`);
  assert.ok(escritorio > 0 && celular > escritorio, "el bloque de celular debe ir después del de escritorio");
  const bloque = css.slice(celular, celular + 900);
  assert.match(bloque, /\.ficha-col \{[^}]*position: absolute/);
  assert.match(bloque, /\.ficha-col \{[^}]*height: 72%/);
});

test("en horizontal la ficha va a un lado y no tapa el mapa desde abajo", () => {
  const i = css.indexOf(`@media ${CONSULTA_APAISADO} {\n  .ficha-col {`);
  assert.ok(i > 0);
  const bloque = css.slice(i, i + 500);
  assert.match(bloque, /left: auto/);
  assert.match(bloque, /top: 0/);
  assert.match(bloque, /width: min\(440px, 56vw\)/);
});
