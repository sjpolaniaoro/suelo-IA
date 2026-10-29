// Predios sin alerta: se separan en tres clases para no leer como «OK» lo que no se evaluó.
//   ok          → se evaluó (A1, A2, A3) y ninguna alerta salta; la cartografía no contradice el registro.
//   ph          → propiedad horizontal: A1 y A2 no aplican (el área se registra por unidad), no está «OK» sino sin evaluar.
//   cartografia → sin alerta de imagen, pero la cartografía oficial dibuja construcción y el registro no (cola «Conciliar en oficina»).
export const CLASES_SIN_ALERTA = [
  ["ok", "OK", "Sin alerta: ninguna regla salta y la cartografía no contradice el registro"],
  ["ph", "PH sin evaluar", "Propiedad horizontal: A1 y A2 no aplican, no se puede decir que esté OK"],
  ["cartografia", "Solo cartografía", "Sin alerta de imagen, pero la cartografía oficial contradice el registro"],
];

export const tieneAlerta = (p) => p.puntaje > 0 || !!p.NR;

export function claseSinAlerta(p) {
  if (tieneAlerta(p)) return null;
  if (p.ph) return "ph";
  return p.accion ? "cartografia" : "ok";
}

export const ETIQUETA_CLASE = { ok: "OK", ph: "PH", cartografia: "CART" };
export const TEXTO_CLASE = {
  ok: "Sin alerta · OK",
  ph: "Sin alerta · propiedad horizontal, sin evaluar",
  cartografia: "Sin alerta de imagen · la cartografía contradice el registro",
};
