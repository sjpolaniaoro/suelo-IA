// Revisiones humanas: viven en el navegador (localStorage) y se exportan a CSV.
const CLAVE = "suelo-ia-revisiones";
let memoria = {};

export function leer() {
  try {
    const t = localStorage.getItem(CLAVE);
    return t ? JSON.parse(t) : { ...memoria };
  } catch {
    return { ...memoria };
  }
}

// Devuelve false si el navegador no permite guardar (las revisiones quedan en memoria).
export function guardar(revisiones) {
  memoria = { ...revisiones };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(revisiones));
    return true;
  } catch {
    return false;
  }
}

const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export function aCsv(filas, columnas) {
  const cab = columnas.map((c) => c[0]).join(",");
  const cuerpo = filas.map((f) => columnas.map((c) => esc(f[c[1]])).join(","));
  return "﻿" + [cab, ...cuerpo].join("\n");
}

export function descargar(nombre, texto) {
  const url = URL.createObjectURL(new Blob([texto], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

export function desdeCsv(texto) {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const parse = (l) => [...l.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/g)].map((m) => m[1].replace(/^"|"$/g, "").replace(/""/g, '"'));
  const cab = parse(lineas[0]);
  const iN = cab.indexOf("npn"), iE = cab.indexOf("estado"), iF = cab.indexOf("fecha");
  if (iN < 0 || iE < 0) throw new Error("El CSV debe tener las columnas npn y estado.");
  const r = {};
  for (const l of lineas.slice(1)) {
    const c = parse(l);
    if (c[iN]) r[c[iN]] = { estado: c[iE], fecha: c[iF] || "" };
  }
  return r;
}
