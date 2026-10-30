// Quién revisa. Hay dos grupos:
//   * Invitado: nombre; envía sus revisiones sin código y no ve las del equipo. El servidor lo marca «invitado».
//   * Funcionario: nombre, equipo y código del equipo; envía y ve las del equipo. Contacto opcional.
// El grupo que se guarda con cada revisión es «Invitado» o el nombre del equipo.
const colapsar = (t) => String(t ?? "").trim().replace(/\s+/g, " ");
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEFONO = /^\+?[\d\s().-]{7,20}$/;

export const LIMITES = { nombre: 60, contacto: 120 };
export const ROLES = [["invitado", "Invitado"], ["funcionario", "Funcionario"]];
export const EQUIPOS = ["testing"]; // equipos configurados (el servidor es quien valida el código)
export const GRUPO_INVITADO = "Invitado";

// Devuelve { valores } o { error }. El contacto, si se escribe, debe ser un correo o un teléfono.
export function validarIdentidad({ nombre, rol, equipo, contacto, codigo }) {
  const n = colapsar(nombre);
  const c = colapsar(contacto);
  if (n.length < 2 || n.length > LIMITES.nombre) return { error: "Escribe tu nombre (de 2 a 60 caracteres)." };
  if (!ROLES.some((r) => r[0] === rol)) return { error: "Elige si entras como invitado o como funcionario." };
  if (rol === "invitado") return { valores: { nombre: n, rol, equipo: "", grupo: GRUPO_INVITADO, contacto: "" } };
  if (!EQUIPOS.includes(equipo)) return { error: "Elige tu equipo." };
  if (!colapsar(codigo)) return { error: "Escribe el código de tu equipo." };
  if (c && (c.length > LIMITES.contacto || !(CORREO.test(c) || TELEFONO.test(c))))
    return { error: "El contacto debe ser un correo o un teléfono válido, o déjalo vacío." };
  return { valores: { nombre: n, rol, equipo, grupo: equipo, contacto: c } };
}

// Perfiles guardados antes de los roles: con código eran del equipo (testing); sin código, de un invitado.
export function normalizarPerfil(e) {
  if (!e || e.rol) return e;
  if (e.codigo) return { ...e, rol: "funcionario", equipo: EQUIPOS[0], grupo: EQUIPOS[0] };
  return { ...e, rol: "invitado", equipo: "", grupo: GRUPO_INVITADO, contacto: "" };
}

// ¿Puede registrar revisiones? Hace falta nombre y grupo.
export const identificado = (equipo) => !!(equipo?.nombre && equipo?.grupo);
export const esFuncionario = (equipo) => equipo?.rol === "funcionario" && !!equipo?.codigo;
// ¿Se envían sus revisiones a la nube? El invitado siempre; el funcionario, con su código.
export const conNube = (equipo) => identificado(equipo) && (equipo.rol === "invitado" || !!equipo.codigo);
