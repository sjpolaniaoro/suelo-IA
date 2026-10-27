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
