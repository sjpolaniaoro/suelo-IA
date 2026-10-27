// Revisiones en equipo: Supabase (Postgres) mediante dos funciones RPC.
// La clave publicable es pública por diseño y NO da acceso a las tablas: las funciones exigen el
// código de equipo y la tabla es de solo anexar (db/migrations). El frontend sigue funcionando sin
// esta conexión: las revisiones se guardan en el navegador y se envían cuando hay red.
const URL_NUBE = import.meta.env?.VITE_SUPABASE_URL || "https://acaexgrlmopqfyxufssa.supabase.co";
const CLAVE_NUBE = import.meta.env?.VITE_SUPABASE_KEY || "sb_publishable_sAxKTNI5x0OYb3ihfvCpdQ_5l4Q0MlW";

// tipo: "codigo" (código incorrecto), "bloqueo" (demasiados intentos), "datos" (rechazó el evento),
// "config" (acceso o configuración; se reintenta) o "red".
export class ErrorNube extends Error {
  constructor(mensaje, tipo) {
    super(mensaje);
    this.tipo = tipo;
  }
}

export function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function rpc(nombre, cuerpo, ms = 8000) {
  const control = new AbortController();
  const t = setTimeout(() => control.abort(), ms);
  let r;
  try {
    r = await fetch(`${URL_NUBE}/rest/v1/rpc/${nombre}`, {
      method: "POST",
      headers: { apikey: CLAVE_NUBE, "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
      signal: control.signal,
    });
  } catch {
    throw new ErrorNube("Sin conexión con el servidor de revisiones.", "red");
  } finally {
    clearTimeout(t);
  }
  if (r.ok) return r.json();
  let detalle = {};
  try { detalle = await r.json(); } catch { /* sin cuerpo */ }
  if (detalle.message === "codigo_invalido") throw new ErrorNube("Código de equipo incorrecto.", "codigo");
  if (r.status >= 500 || r.status === 429) throw new ErrorNube("El servidor de revisiones no responde.", "red");
  // Solo un rechazo por los datos (400, 409, 422) permite descartar el evento; un 401, 403 o 404 es de
  // configuración (clave rotada, función ausente) y el evento debe seguir en la cola.
  if ([400, 409, 422].includes(r.status)) throw new ErrorNube(detalle.message || "El servidor rechazó la revisión.", "datos");
  throw new ErrorNube("El servidor de revisiones rechazó la solicitud (acceso o configuración).", "config");
}

// Desde la migración 0003 las funciones no lanzan error ante un código malo (un error revertiría el
// contador de intentos): devuelven {ok:false, error}. Las versiones anteriores lanzaban un error HTTP y
// devolvían un arreglo o un uuid; se aceptan las dos formas para poder desplegar en cualquier orden.
export function interpretar(resp) {
  if (resp && typeof resp === "object" && !Array.isArray(resp) && "ok" in resp) {
    if (resp.ok) return resp;
    if (resp.error === "codigo_invalido") throw new ErrorNube("Código de equipo incorrecto.", "codigo");
    if (resp.error === "demasiados_intentos") throw new ErrorNube("Demasiados intentos con el código. Espera unos minutos.", "bloqueo");
    throw new ErrorNube("El servidor rechazó la solicitud.", "datos");
  }
  return resp;
}

export const leerNube = async (codigo) => {
  const r = interpretar(await rpc("leer_revisiones", { p_codigo: codigo }));
  return Array.isArray(r) ? r : r.filas;
};

export const enviarNube = async (ev, codigo) =>
  interpretar(await rpc("registrar_revision", {
    p_id: ev.id,
    p_npn: ev.npn,
    p_estado: ev.estado,
    p_revisor: ev.revisor,
    p_codigo: codigo,
    p_fecha: ev.fecha,
    p_puntaje: ev.puntaje ?? null,
    p_alertas: ev.alertas ?? null,
    p_triangulacion: ev.triangulacion ?? null,
    p_accion: ev.accion ?? null,
    p_version: ev.version ?? null,
  }));
