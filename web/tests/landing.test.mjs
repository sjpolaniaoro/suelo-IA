// Pruebas de la portada usada como pitch. Se ejecutan con `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");
const html = leer("../index.html");
const js = leer("../src/landing/landing.js");
const sincronizar = leer("../scripts/sincronizar-cifras.mjs");
const resumen = JSON.parse(leer("../public/data/resumen.json"));

test("las secciones siguen el orden de la guía de presentación", () => {
  const ids = [...html.matchAll(/<section[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
  const orden = [
    "problema",
    "solucion",
    "ia",
    "alertas",
    "demo",
    "impacto",
    "responsable",
    "viabilidad",
    "ruta",
    "equipo",
    "piloto",
    "limites",
  ];
  assert.deepEqual(ids, orden);
});

test("cada sección con aria-labelledby apunta a un encabezado que existe", () => {
  for (const [, id] of html.matchAll(/aria-labelledby="([^"]+)"/g))
    assert.ok(html.includes(`id="${id}"`), "falta el id " + id);
});

test("el menú enlaza solo a secciones que existen", () => {
  const nav = html.slice(html.indexOf('<nav id="navegacion"'), html.indexOf("</nav>"));
  for (const [, id] of nav.matchAll(/href="#([^"]+)"/g))
    assert.ok(html.includes(`id="${id}"`), "enlace roto: #" + id);
});

test("toda cifra con data-stat se calcula en el navegador y en el build", () => {
  const claves = new Set([...html.matchAll(/data-stat="([^"]+)"/g)].map((m) => m[1]));
  assert.ok(claves.size > 20);
  for (const clave of claves) {
    const aparece = new RegExp(`\\b${clave}\\b`);
    assert.match(js, aparece, "landing.js no calcula " + clave);
    assert.match(sincronizar, aparece, "sincronizar-cifras no calcula " + clave);
  }
});

test("las cifras del resumen que usa el pitch existen y son números", () => {
  const numeros = [
    resumen.tasa_cruce,
    resumen.predios_registro,
    resumen.predios_sin_geometria,
    resumen.predios_con_alerta,
    resumen.predios_uso_no_residencial,
    resumen.contexto_urbano?.habitacionales_no_ph,
    resumen.contexto_urbano?.sin_area_construida,
    resumen.triangulacion?.cola_oficina,
    resumen.triangulacion?.cola_campo,
  ];
  for (const n of numeros) assert.ok(Number.isFinite(n));
});

test("no hay cifras de conteo escritas a mano que contradigan el resumen", () => {
  // El deck decía 1.285 (1.283 de vivienda + 2 NR); la portada las muestra por separado.
  assert.ok(!html.includes("1.285"));
  // El titular de prensa de «35 %» y «12 años» no tiene fuente en el proyecto.
  assert.ok(!/35\s?%\s+(requiere|de expansión)/i.test(html));
  assert.ok(!/12 años/.test(html));
});

test("lo previsto se rotula como previsto y no como función del piloto", () => {
  const ruta = html.slice(html.indexOf('id="ruta"'), html.indexOf('id="equipo"'));
  assert.match(ruta, /No son funciones del piloto actual/);
  const viabilidad = html.slice(html.indexOf('id="viabilidad"'), html.indexOf('id="ruta"'));
  assert.match(viabilidad, /Previsto/);
});

test("el reparto del incentivo suma 100 % y $5.000.000", () => {
  const bloque = html.slice(html.indexOf('class="sia-incentivo"'), html.indexOf('id="equipo"'));
  const porcentajes = [...bloque.matchAll(/<strong>(\d+) %<\/strong>/g)].map((m) => Number(m[1]));
  assert.equal(porcentajes.reduce((a, b) => a + b, 0), 100);
  const montos = [...bloque.matchAll(/<b>\$([\d.]+)<\/b>/g)].map((m) => Number(m[1].replaceAll(".", "")));
  assert.equal(montos.reduce((a, b) => a + b, 0), 5000000);
});

test("las imágenes de los QR existen y tienen texto alternativo", () => {
  for (const archivo of ["qr-demo.svg", "qr-repo.svg"]) {
    assert.ok(html.includes("/img/" + archivo));
    assert.match(leer("../public/img/" + archivo), /^<svg /);
  }
  for (const [etiqueta] of html.matchAll(/<img[^>]*qr-[a-z]+\.svg[^>]*>/g))
    assert.match(etiqueta, /alt="[^"]{10,}"/);
});
