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

// Elegir una decisión solo arma un borrador; la revisión se registra al pulsar «Enviar registro».
// `borrador` trae lo elegido en el predio abierto ({ estado, motivo, fuente }, cada campo solo si se tocó);
// lo no tocado se toma de la revisión ya enviada, para poder corregir solo la fuente o solo la decisión.
export function seleccionActual(revision, borrador = {}) {
  const estado = borrador.estado ?? revision?.estado ?? null;
  const motivo = borrador.estado ? borrador.motivo ?? null : revision?.motivo ?? null;
  const fuente = "fuente" in borrador ? borrador.fuente ?? null : revision?.fuente ?? null;
  return { estado, motivo: estado === "no_concluyente" ? motivo : null, fuente };
}

// ¿Hay algo nuevo por enviar? Sin decisión elegida no; con una revisión ya enviada, solo si algo cambió.
export function hayCambio(revision, seleccion) {
  if (!seleccion.estado) return false;
  if (!revision) return true;
  return revision.estado !== seleccion.estado
    || (revision.motivo ?? null) !== (seleccion.motivo ?? null)
    || (revision.fuente ?? null) !== (seleccion.fuente ?? null);
}
