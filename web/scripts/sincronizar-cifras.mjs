import { readFile, writeFile } from "node:fs/promises";

// Se genera HTML con cifras vigentes también para lectores sin JavaScript.
const root = new URL("../", import.meta.url);
const resumen = JSON.parse(
  await readFile(new URL("public/data/resumen.json", root), "utf8"),
);
const numero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const fecha = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Bogota",
});
const valores = {};
for (const key of [
  "predios_con_geometria",
  "predios_con_alerta",
  "A1",
  "A2",
  "A3",
]) {
  const valor = key.startsWith("A") ? resumen.alertas?.[key] : resumen[key];
  if (!Number.isFinite(valor)) throw new Error("Cifra inválida: " + key);
  valores[key] = numero.format(valor);
}
// Planteamiento del problema: habitacionales sin propiedad horizontal sin área construida en el sector.
const pct = new Intl.NumberFormat("es-CO", { style: "percent", maximumFractionDigits: 1 });
for (const key of ["sin_area_construida", "habitacionales_no_ph"])
  if (!Number.isFinite(resumen[key])) throw new Error("Cifra inválida: " + key);
valores.sec_sin_area = numero.format(resumen.sin_area_construida);
valores.sec_hab = numero.format(resumen.habitacionales_no_ph);
valores.sec_pct = pct.format(resumen.sin_area_construida / resumen.habitacionales_no_ph);
// Escenarios del carrusel: alerta NR, triangulación y confianza baja.
const tri = resumen.triangulacion;
if (!tri) throw new Error("El resumen no trae la triangulación");
for (const [key, valor] of [
  ["NR", resumen.predios_uso_no_residencial],
  ["tri_dos_fuentes", tri.dos_fuentes],
  ["tri_solo_imagen", tri.solo_imagen],
  ["tri_solo_cartografia", tri.solo_cartografia],
  ["tri_sin_evidencia", tri.sin_evidencia],
  ["confianza_baja", resumen.confianza_baja],
]) {
  if (!Number.isFinite(valor)) throw new Error("Cifra inválida: " + key);
  valores[key] = numero.format(valor);
}
// Escala de la ciudad, cobertura y colas de revisión (secciones de problema e impacto).
const ctx = resumen.contexto_urbano;
if (!ctx) throw new Error("El resumen no trae el contexto urbano");
for (const [key, valor] of [
  ["ctx_registro", ctx.predios_registro],
  ["ctx_hab", ctx.habitacionales_no_ph],
  ["ctx_sin_area", ctx.sin_area_construida],
  ["predios_registro", resumen.predios_registro],
  ["predios_sin_geometria", resumen.predios_sin_geometria],
  ["tri_universo", tri.universo_sin_area],
  ["cola_oficina", tri.cola_oficina],
  ["cola_campo", tri.cola_campo],
]) {
  if (!Number.isFinite(valor)) throw new Error("Cifra inválida: " + key);
  valores[key] = numero.format(valor);
}
if (!Number.isFinite(resumen.tasa_cruce)) throw new Error("Cifra inválida: tasa_cruce");
valores.tasa_cruce = pct.format(resumen.tasa_cruce);
valores.ctx_pct = pct.format(ctx.sin_area_construida / ctx.habitacionales_no_ph);
valores.generado = fecha.format(new Date(resumen.generado));
const path = new URL("index.html", root);
const html = await readFile(path, "utf8");
const actualizado = html.replace(
  /(<(?:span|dd|strong)\b[^>]*\bdata-stat="([^"]+)"[^>]*>)[^<]*(<\/(?:span|dd|strong)>)/g,
  (_, inicio, key, fin) => {
    if (!(key in valores)) throw new Error("Cifra sin fuente: " + key);
    return inicio + valores[key] + fin;
  },
);
if (html !== actualizado) await writeFile(path, actualizado);
