// Quién revisa: nombre y grupo (obligatorios) y un contacto opcional, que se guardan con cada revisión.
const colapsar = (t) => String(t ?? "").trim().replace(/\s+/g, " ");
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEFONO = /^\+?[\d\s().-]{7,20}$/;

export const LIMITES = { nombre: 60, grupo: 60, contacto: 120 };

// Devuelve { valores } o { error }. El contacto, si se escribe, debe ser un correo o un teléfono.
export function validarIdentidad({ nombre, grupo, contacto }) {
  const n = colapsar(nombre);
  const g = colapsar(grupo);
  const c = colapsar(contacto);
  if (n.length < 2 || n.length > LIMITES.nombre) return { error: "Escribe tu nombre (de 2 a 60 caracteres)." };
  if (g.length < 1 || g.length > LIMITES.grupo) return { error: "Escribe tu grupo (hasta 60 caracteres)." };
  if (c && (c.length > LIMITES.contacto || !(CORREO.test(c) || TELEFONO.test(c))))
    return { error: "El contacto debe ser un correo o un teléfono válido, o déjalo vacío." };
  return { valores: { nombre: n, grupo: g, contacto: c } };
}

// ¿Puede registrar revisiones? Hace falta nombre y grupo (los perfiles guardados antes no tenían grupo).
export const identificado = (equipo) => !!(equipo?.nombre && equipo?.grupo);
