import { claseSinAlerta, tieneAlerta } from "./clases.js";

// Cada predio tiene un valor en cada dimensión y los filtros se combinan con «y»:
//   prioridad: alta / media / baja / «ninguna» (sin prioridad: sin alerta, o NR, que no tiene puntaje de vivienda)
//   tipo de alerta: A1, A2, A3, NR o «ninguna» (sin alerta)
//   cola de trabajo: oficina, campo o ninguna
// Los predios sin prioridad solo pasan con «Sin prioridad» activo y con tipo «Todas» o «Ninguna» (no tienen tipo de alerta).
export const SIN_PRIORIDAD = "ninguna";
export const nivelDe = (p) => (tieneAlerta(p) && !p.NR ? p.nivel : SIN_PRIORIDAD);

export const pasaAccion = (p, filtros) => {
  const a = filtros.accion;
  if (!a || a === "todas") return true;
  return a === "ninguna" ? !p.accion : p.accion === a;
};

export function pasaFiltros(p, filtros) {
  const sinPrioridad = filtros.niveles.has(SIN_PRIORIDAD);
  if (!tieneAlerta(p)) {
    return sinPrioridad && (filtros.tipo === "todas" || filtros.tipo === "ninguna") && !!filtros.sinAlerta?.has(claseSinAlerta(p)) && pasaAccion(p, filtros);
  }
  if (p.NR) return (filtros.tipo === "NR" || (filtros.tipo === "todas" && sinPrioridad && !!filtros.sinAlerta?.has("nr"))) && pasaAccion(p, filtros);
  if (filtros.tipo === "NR" || filtros.tipo === "ninguna") return false;
  return (filtros.tipo === "todas" || p[filtros.tipo]) && filtros.niveles.has(p.nivel) && pasaAccion(p, filtros);
}
