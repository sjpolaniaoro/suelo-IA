/* Deriva ilustración y ficha de los datos publicados; no modifica el pipeline. */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
const web = new URL("../", import.meta.url);
const source = await readFile(
  new URL("public/data/sector02.geojson", web),
  "utf8",
);
const features = JSON.parse(source).features.filter((f) => f.geometry);
const example = features
  .filter(
    (f) =>
      f.properties.A1 &&
      f.properties.confianza === "normal" &&
      f.properties.area_terreno < 300,
  )
  .sort((a, b) => a.properties.npn.localeCompare(b.properties.npn))[0];
if (!example) throw new Error("No hay un predio de ejemplo verificable.");
const rings = (f) =>
  f.geometry.type === "Polygon"
    ? f.geometry.coordinates
    : f.geometry.coordinates.flat();
const unique = [
  ...new Map(features.map((f) => [f.properties.npn.slice(0, 21), f])).values(),
];
const pts = unique.flatMap(rings).flat();
const xs = pts.map((p) => p[0]),
  ys = pts.map((p) => p[1]);
const bounds = [
  xs.reduce((a, b) => Math.min(a, b)),
  ys.reduce((a, b) => Math.min(a, b)),
  xs.reduce((a, b) => Math.max(a, b)),
  ys.reduce((a, b) => Math.max(a, b)),
];
const cos = Math.cos((((bounds[1] + bounds[3]) / 2) * Math.PI) / 180);
const scale = Math.min(
  880 / ((bounds[2] - bounds[0]) * cos),
  720 / (bounds[3] - bounds[1]),
);
const x = (p) => 500 + (p[0] - (bounds[0] + bounds[2]) / 2) * cos * scale;
const y = (p) => 410 - (p[1] - (bounds[1] + bounds[3]) / 2) * scale;
// Simplificación solo de la ilustración, a media unidad del viewBox; los datos no cambian.
function simplify(points) {
  const start = points[0],
    end = points.at(-1);
  const dx = end[0] - start[0],
    dy = end[1] - start[1];
  let farthest = 0.25,
    index = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const t =
      dx || dy
        ? Math.max(
            0,
            Math.min(
              1,
              ((points[i][0] - start[0]) * dx +
                (points[i][1] - start[1]) * dy) /
                (dx * dx + dy * dy),
            ),
          )
        : 0;
    const distance =
      (points[i][0] - start[0] - t * dx) ** 2 +
      (points[i][1] - start[1] - t * dy) ** 2;
    if (distance > farthest) {
      farthest = distance;
      index = i;
    }
  }
  if (index < 0) return [start, end];
  return [
    ...simplify(points.slice(0, index + 1)).slice(0, -1),
    ...simplify(points.slice(index)),
  ];
}
const path = (f) =>
  rings(f)
    .map((ring) => {
      const projected = ring.map((p) => [x(p), y(p)]);
      const reduced = simplify(projected);
      const points = reduced.length >= 4 ? reduced : projected;
      return (
        points
          .slice(0, -1)
          .map(
            (p, i) => `${i ? "L" : "M"}${Math.round(p[0])} ${Math.round(p[1])}`,
          )
          .join("") + "Z"
      );
    })
    .join("");
// Un solo path agrupa el contexto; el acento identifica el ejemplo, no su prioridad.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 820"><title>Cartografía predial del sector urbano 02 de Neiva</title><desc>Vista de contexto derivada de la cartografía de la Alcaldía de Neiva. Un predio de ejemplo se destaca en azul. No representa prioridades.</desc><g fill="#e2e9ee" stroke="#7c94a8" stroke-width=".65" stroke-linejoin="round"><path d="${unique.map(path).join("")}"/></g><path d="${path(example)}" fill="#416180" stroke="#1d1f20" stroke-width="2"/></svg>`;
await mkdir(new URL("public/img/", web), { recursive: true });
await writeFile(new URL("public/img/plano-sector02.svg", web), svg);
const p = example.properties;
const sample = {
  npn: p.npn,
  direccion: p.direccion,
  area_construida_reg: p.area_construida_reg,
  area_huella: p.area_huella,
  confianza: p.confianza,
  razon: p.razones[0],
  vigencia: p.vigencia,
  generado_desde_sha256: createHash("sha256").update(source).digest("hex"),
};
await writeFile(
  new URL("src/landing/ejemplo.json", web),
  JSON.stringify(sample, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    predio: p.npn,
    bytes_svg: Buffer.byteLength(svg),
    sha256: sample.generado_desde_sha256,
  }),
);
