// Carga de datos: primero archivos estáticos (el frontend funciona sin la API).
const BASE = import.meta.env.BASE_URL + "data/";
export const API_URL = import.meta.env.VITE_API_URL || "";

async function json(ruta) {
  const r = await fetch(ruta);
  if (!r.ok) throw new Error(`${ruta}: ${r.status}`);
  return r.json();
}

export async function cargarSector() {
  const [predios, resumen, manifiesto] = await Promise.all([
    json(BASE + "sector02.geojson"),
    json(BASE + "resumen.json"),
    json(BASE + "manifiesto.json").catch(() => null),
  ]);
  const huellas = await json(BASE + "huellas_sector02.geojson").catch(() => null);
  return { predios, resumen, manifiesto, huellas };
}

function conTiempo(url, ms = 3000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t));
}

// La API (Render, plan gratuito) puede estar dormida: nunca bloquea la pantalla.
export async function apiDisponible() {
  if (!API_URL) return false;
  try {
    return (await conTiempo(API_URL + "/health")).ok;
  } catch {
    return false;
  }
}

export async function fichaDesdeApi(npn) {
  const r = await conTiempo(`${API_URL}/predios/${encodeURIComponent(npn)}`);
  if (!r.ok) throw new Error("API");
  return (await r.json()).properties;
}

export function limites(fc) {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  const rec = (c) => {
    if (typeof c[0] === "number") {
      x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]);
      y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]);
    } else c.forEach(rec);
  };
  fc.features.forEach((f) => f.geometry && rec(f.geometry.coordinates));
  return [[x0, y0], [x1, y1]];
}
