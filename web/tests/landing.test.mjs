// Pruebas de la portada usada como pitch. Se ejecutan con `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const leer = (ruta) => readFileSync(new URL(ruta, import.meta.url), "utf8");
const html = leer("../index.html");
const js = leer("../src/landing/landing.js");
const sincronizar = leer("../scripts/sincronizar-cifras.mjs");
const resumen = JSON.parse(leer("../public/data/resumen.json"));

test("las secciones siguen el hilo: dolor, solución, mecánica, ejemplo, impacto, confianza, ruta y llamado", () => {
  const ids = [...html.matchAll(/<section[^>]*\bid="([^"]+)"/g)].map((m) => m[1]);
  const orden = [
    "problema",
    "solucion",
    "ia",
    "alertas",
    "demo",
    "impacto",
    "responsable",
    "ruta",
    "limites",
    "piloto",
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
  // 1.285 es 1.283 de vivienda + 2 NR («Por revisar» del mapa): solo puede salir del resumen.
  assert.ok(!html.replace(/<span data-stat="por_revisar">[^<]*<\/span>/, "").includes("1.285"));
  assert.equal(resumen.predios_con_alerta + resumen.predios_uso_no_residencial, 1285);
  // El titular de prensa de «35 %» y «12 años» no tiene fuente en el proyecto.
  assert.ok(!/35\s?%\s+(requiere|de expansión)/i.test(html));
  assert.ok(!/12 años/.test(html));
});

test("lo previsto se rotula como previsto y no como función del piloto", () => {
  const ruta = html.slice(html.indexOf('id="ruta"'), html.indexOf('id="limites"')).replace(/\s+/g, " ");
  assert.match(ruta, /No son funciones del piloto actual/);
  assert.match(ruta, /Previsto/);
  assert.match(ruta, /Sostenibilidad · previsto/);
});

test("el reparto del incentivo suma 100 % y $5.000.000", () => {
  const bloque = html.slice(html.indexOf('class="sia-incentivo"'), html.indexOf('id="limites"'));
  const porcentajes = [...bloque.matchAll(/<strong>(\d+) %<\/strong>/g)].map((m) => Number(m[1]));
  assert.equal(porcentajes.reduce((a, b) => a + b, 0), 100);
  const montos = [...bloque.matchAll(/<b>\$([\d.]+)<\/b>/g)].map((m) => Number(m[1].replaceAll(".", "")));
  assert.equal(montos.reduce((a, b) => a + b, 0), 5000000);
});

test("las imágenes de los QR existen y tienen texto alternativo", () => {
  for (const archivo of ["qr-demo.svg"]) {
    assert.ok(html.includes("/img/" + archivo));
    assert.match(leer("../public/img/" + archivo), /^<svg /);
  }
  for (const [etiqueta] of html.matchAll(/<img[^>]*qr-[a-z]+\.svg[^>]*>/g))
    assert.match(etiqueta, /alt="[^"]{10,}"/);
});

test("la portada abre con el dolor y la cifra de ciudad", () => {
  const portada = html.slice(html.indexOf('class="sia-cover"'), html.indexOf('class="sia-rio"'));
  assert.match(portada, /El registro dice que no hay nada construido/);
  for (const clave of ["ctx_sin_area", "ctx_hab", "ctx_pct"])
    assert.ok(portada.includes(`data-stat="${clave}"`), "falta " + clave + " en la portada");
  // El dolor va antes que la descripción de la herramienta.
  assert.ok(portada.indexOf("sia-problema") < portada.indexOf("sia-lead"));
});

test("el cierre devuelve al predio de ejemplo", () => {
  const cierre = html.slice(html.indexOf('class="sia-closing"'), html.indexOf("</main>"));
  assert.match(cierre, /data-example-link/);
  assert.match(js, /\?predio=/);
});

test("ningún panel de la portada se desplaza en horizontal", () => {
  for (const archivo of ["landing.css", "neiva.css", "pitch.css"])
    assert.ok(!/overflow-x\s*:\s*(auto|scroll)/.test(leer("../src/landing/" + archivo)), archivo + " usa overflow-x");
  assert.ok(!/scroll-snap-type/.test(leer("../src/landing/neiva.css")));
});

test("la barra de triangulación toma sus anchos del resumen", () => {
  for (const clave of ["dos_fuentes", "solo_cartografia", "solo_imagen", "sin_evidencia"]) {
    assert.ok(html.includes(`data-tri="${clave}"`), "falta el segmento " + clave);
    assert.ok(Number.isFinite(resumen.triangulacion[clave]));
  }
  const suma = ["dos_fuentes", "solo_cartografia", "solo_imagen", "sin_evidencia"]
    .map((k) => resumen.triangulacion[k])
    .reduce((a, b) => a + b, 0);
  assert.equal(suma, resumen.triangulacion.universo_sin_area);
});

test("el QR de #demo abre la ficha del predio de ejemplo", () => {
  const demo = html.slice(html.indexOf('id="demo"'), html.indexOf('id="impacto"'));
  assert.match(demo, /abre en el celular la ficha del predio de ejemplo/);
  const svg = leer("../public/img/qr-demo.svg");
  assert.match(svg, /^<svg /);
  // La URL codificada se comprueba al regenerar el QR (ver DISENO.md); aquí, que el NPN del ejemplo exista.
  const ejemplo = JSON.parse(leer("../src/landing/ejemplo.json"));
  assert.match(ejemplo.npn, /^\d{30}$/);
});
