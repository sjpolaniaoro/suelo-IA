// Contraste registro / cartografía / imagen: la ficha y el filtro «Registro vs cartografía» dependen de esto.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { UMBRALES, concordancia, enriquecer, evaluar } from "../src/consistencia.js";
import { pasaFiltros } from "../src/filtros.js";

const base = { ph: false, A1: false, A2: false, A3: false, NR: false, area_construida_reg: 0, area_cart: 0, area_huella: 0, confianza_media: 0.85, n_huellas: 2 };

test("registro sin área y cartografía con construcción: dos fuentes, registro desactualizado", () => {
  const ev = evaluar({ ...base, A1: true, area_cart: 129.2, area_huella: 190.9, triangulacion: "dos_fuentes" });
  assert.equal(ev.estado, "inconsistente");
  assert.equal(ev.pares.regCart.sentido, "cartografia_mayor");
  assert.equal(ev.pares.regCart.conc, 0);
  assert.equal(ev.confianzaImagen, 85);
  assert.equal(ev.diagnostico.nivel, "alto");
  assert.match(ev.diagnostico.detalle, /129 m²/);
  assert.match(ev.diagnostico.detalle, /191 m²/);
});

test("registro mayor que cartografía también es inconsistencia, sin alerta de imagen", () => {
  const ev = evaluar({ ...base, area_construida_reg: 120, area_cart: 60 });
  assert.equal(ev.estado, "inconsistente");
  assert.equal(ev.pares.regCart.sentido, "registro_mayor");
  assert.equal(ev.pares.regCart.conc, 50);
  assert.match(ev.diagnostico.titulo, /registro declara más/);
});

test("diferencias dentro de la tolerancia o bajo el mínimo no cuentan", () => {
  assert.equal(evaluar({ ...base, area_construida_reg: 100, area_cart: 115 }).estado, "coincide"); // 15 % < 20 %
  assert.equal(evaluar({ ...base, area_construida_reg: 0, area_cart: 6 }).estado, "coincide"); // bajo 10 m²
  assert.equal(evaluar({ ...base, area_construida_reg: 100, area_cart: 100 }).diagnostico, null);
});

test("propiedad horizontal: no aplica, pero conserva las cifras", () => {
  const ev = evaluar({ ...base, ph: true, area_construida_reg: 80, area_cart: 300 });
  assert.equal(ev.estado, "no_aplica");
  assert.equal(ev.pares, null);
  assert.equal(ev.reg, 80);
  assert.equal(ev.cart, 300);
});

test("solo cartografía y solo imagen nombran qué fuente no respalda a cuál", () => {
  const c = evaluar({ ...base, area_cart: 70, area_huella: 4, triangulacion: "solo_cartografia" });
  assert.match(c.diagnostico.titulo, /la imagen no lo confirma/);
  const i = evaluar({ ...base, A2: true, area_construida_reg: 50, area_cart: 52, area_huella: 90, triangulacion: "solo_imagen" });
  assert.match(i.diagnostico.titulo, /Solo la imagen/);
  assert.equal(i.pares.regImg.discrepa, true);
});

test("sin evidencia de imágenes no se inventa el área de imagen", () => {
  const ev = evaluar({ ...base, area_cart: 50 }, UMBRALES, false);
  assert.equal(ev.img, null);
  assert.equal(ev.pares.regImg, null);
  assert.equal(ev.confianzaImagen, null);
});

test("concordancia es la menor sobre la mayor", () => {
  assert.equal(concordancia(0, 0), 100);
  assert.equal(concordancia(100, 80), 80);
});

test("el filtro de consistencia se combina con los demás", () => {
  const fc = enriquecer({ features: [{ properties: { ...base, area_cart: 90 } }, { properties: { ...base } }] });
  const f = { tipo: "todas", niveles: new Set(["ninguna"]), accion: "todas", sinAlerta: new Set(["ok", "ph", "cartografia", "nr"]) };
  const [a, b] = fc.features.map((x) => x.properties);
  assert.equal(pasaFiltros(a, { ...f, cons: "inconsistente" }), true);
  assert.equal(pasaFiltros(b, { ...f, cons: "inconsistente" }), false);
  assert.equal(pasaFiltros(b, { ...f, cons: "todas" }), true);
});

test("el resumen del pipeline trae los umbrales que usa la web", () => {
  const r = JSON.parse(readFileSync(new URL("../public/data/resumen.json", import.meta.url), "utf8"));
  assert.deepEqual(r.umbrales_consistencia, UMBRALES);
});
