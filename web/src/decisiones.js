// Opciones de decisión al revisar un predio. Son iguales para todos los predios (con alerta, sin alerta y
// propiedad horizontal): «Hay error» o «Está OK», y dos formas de «no concluyente».
// El valor guardado (`estado`) no cambia: confirmado = hay error, descartado = está OK, no_concluyente.
// Por eso la base, los CSV y las métricas de validación siguen leyendo los mismos estados.
export const DECISIONES = [
  { k: "confirmado", t: "Hay error – corregir", tecla: "C", ayuda: "El registro no coincide con lo construido: hay que corregirlo" },
  { k: "descartado", t: "Está OK – sin error", tecla: "D", ayuda: "El registro coincide con lo construido: no hay nada que corregir" },
  { k: "no_concluyente", motivo: "insuficiente", t: "Evidencia insuficiente", tecla: "N", ayuda: "Se pudo mirar, pero la evidencia no alcanza para decidir" },
  { k: "no_concluyente", motivo: "no_ubicado", t: "No se pudo ubicar", tecla: "U", ayuda: "No se pudo ubicar el predio o no hubo acceso" },
];
export const MOTIVOS = ["insuficiente", "no_ubicado"];

// Qué fuente tenía el error (con «Hay error») o está desactualizada (con «Está OK»). Opcional, en toda decisión.
export const FUENTES = [
  ["registro", "Registro"],
  ["cartografia", "Cartografía"],
  ["imagen", "Imagen"],
  ["ninguna", "Todas coinciden"],
];
export const CLAVES_FUENTE = FUENTES.map((f) => f[0]);

const mismo = (d, r) => !!r && d.k === r.estado && (d.motivo ?? null) === (r.motivo ?? null);
export const decisionActiva = (revision) => DECISIONES.find((d) => mismo(d, revision));

// Texto de una revisión guardada. Un «no concluyente» anterior a los dos motivos queda con su nombre de siempre.
export function etiquetaDecision(revision) {
  if (!revision) return "";
  if (revision.estado === "no_concluyente" && !revision.motivo) return "No concluyente";
  return decisionActiva(revision)?.t ?? revision.estado;
}

export const etiquetaFuente = (clave) => FUENTES.find((f) => f[0] === clave)?.[1] ?? "";

// Para el atajo de teclado (C, D, N, U).
export const decisionDeTecla = (tecla) => DECISIONES.find((d) => d.tecla.toLowerCase() === tecla);
