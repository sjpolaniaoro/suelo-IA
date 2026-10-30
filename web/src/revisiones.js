import { ESTADOS } from "./validar.js";
import { CLAVES_FUENTE, MOTIVOS } from "./decisiones.js";

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

// Equipo (nombre y código) y cola de eventos pendientes de enviar: viven en el navegador.
const CLAVE_EQUIPO = "suelo-ia-equipo";
const CLAVE_COLA = "suelo-ia-cola";
const leerJson = (clave, defecto) => {
  try {
    const t = localStorage.getItem(clave);
    return t ? JSON.parse(t) : defecto;
  } catch {
    return defecto;
  }
};
const guardarJson = (clave, valor) => {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch { /* sin almacenamiento: la sesión sigue en memoria */ }
};
export const leerEquipo = () => leerJson(CLAVE_EQUIPO, null);
export const guardarEquipo = (e) => guardarJson(CLAVE_EQUIPO, e);
export const borrarEquipo = () => {
  try { localStorage.removeItem(CLAVE_EQUIPO); } catch { /* sin almacenamiento */ }
};
export const leerCola = () => leerJson(CLAVE_COLA, []);
export const guardarCola = (c) => guardarJson(CLAVE_COLA, c);

// Una hoja de cálculo evalúa como fórmula las celdas de texto que empiezan por = + - @ tab o retorno.
// Se antepone una comilla simple (desdeCsv la quita al reimportar). Los números no se tocan.
const FORMULA = /^[=+\-@\t\r]/;
const esc = (v) => {
  // Las listas (por ejemplo `razones`) se unen en un texto y se tratan igual que cualquier celda de texto.
  let t = Array.isArray(v) ? v.join("; ") : String(v ?? "");
  if (typeof v !== "number" && FORMULA.test(t)) t = `'${t}`;
  return `"${t.replace(/"/g, '""')}"`;
};
const sinPrefijo = (t) => t.replace(/^'(?=[=+\-@\t\r])/, "");

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

const MAX_FILAS_CSV = 50000;
// Una fecha fuera de rango (más de un día en el futuro o anterior a 2020) se vacía: la fecha decide qué
// evento es el vigente, así que un archivo ajeno no debe poder fijar un estado hacia el futuro.
function fechaSegura(texto) {
  const ms = Date.parse(texto || "");
  if (!Number.isFinite(ms) || ms > Date.now() + 86400000 || ms < Date.UTC(2020, 0, 1)) return "";
  return new Date(ms).toISOString();
}

export function desdeCsv(texto) {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  if (lineas.length > MAX_FILAS_CSV + 1) throw new Error(`El CSV trae más de ${MAX_FILAS_CSV} filas.`);
  const parse = (l) => [...l.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/g)].map((m) => m[1].replace(/^"|"$/g, "").replace(/""/g, '"'));
  const cab = parse(lineas[0]);
  const iN = cab.indexOf("npn"), iE = cab.indexOf("estado"), iF = cab.indexOf("fecha"), iR = cab.indexOf("revisor");
  const iM = cab.indexOf("motivo"), iU = cab.indexOf("fuente_error");
  if (iN < 0 || iE < 0) throw new Error("El CSV debe tener las columnas npn y estado.");
  const r = {};
  for (const l of lineas.slice(1)) {
    const c = parse(l).map(sinPrefijo);
    // Solo entran filas con npn de 30 dígitos y un estado válido; el resto se ignora.
    if (!/^\d{30}$/.test(c[iN] || "") || !ESTADOS.includes(c[iE])) continue;
    const fecha = fechaSegura(c[iF]);
    const revisor = iR >= 0 ? (c[iR] || "").trim().slice(0, 60) : "";
    // origen "csv": lo importado se queda en este navegador; no se sube solo al equipo al activarlo.
    const motivo = iM >= 0 && c[iE] === "no_concluyente" && MOTIVOS.includes(c[iM]) ? c[iM] : "";
    const fuente = iU >= 0 && CLAVES_FUENTE.includes(c[iU]) ? c[iU] : "";
    r[c[iN]] = { estado: c[iE], fecha, origen: "csv", ...(revisor ? { revisor } : {}), ...(motivo ? { motivo } : {}), ...(fuente ? { fuente } : {}) };
  }
  if (!Object.keys(r).length) throw new Error("El CSV no trae revisiones válidas (npn de 30 dígitos y estado confirmado, descartado o no_concluyente).");
  return r;
}
