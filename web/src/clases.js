// Predios sin alerta: se separan en tres clases para no leer como «OK» lo que no se evaluó.
//   ok          → se evaluó (A1, A2, A3) y ninguna alerta salta; la cartografía no contradice el registro.
//   ph          → propiedad horizontal: A1 y A2 no aplican (el área se registra por unidad), no está «OK» sino sin evaluar.
//   cartografia → sin alerta de imagen, pero la cartografía oficial dibuja construcción y el registro no (cola «Conciliar en oficina»).
export const CLASES_SIN_ALERTA = [
  ["ok", "OK", "Sin alerta: ninguna regla salta y la cartografía no contradice el registro"],
  ["ph", "PH sin evaluar", "Propiedad horizontal: A1 y A2 no aplican, no se puede decir que esté OK"],
  ["cartografia", "Solo cartografía", "Sin alerta de imagen, pero la cartografía oficial contradice el registro"],
];

// En el filtro «Sin prioridad» también entra NR (uso probablemente no residencial): no tiene puntaje de vivienda.
CLASES_SIN_ALERTA.push(["nr", "NR · revisar destino", "Uso probablemente no residencial: sin puntaje de vivienda, pide revisar el destino"]);

// La cola de revisión son los predios con alerta de vivienda (A1, A2 o A3). NR queda en «Sin prioridad»: se revisa
// el destino, pero no tiene puntaje y no entra en el embudo, para que el total sea 1.283 + sin prioridad = 7.329.
export const requiereRevision = (p) => p.puntaje > 0;

export const tieneAlerta = (p) => p.puntaje > 0 || !!p.NR;

export function claseSinAlerta(p) {
  if (tieneAlerta(p)) return null;
  if (p.ph) return "ph";
  return p.accion ? "cartografia" : "ok";
}

// Clase dentro de «Sin prioridad»: las tres sin alerta más NR.
export const claseSinPrioridad = (p) => (p.NR ? "nr" : claseSinAlerta(p));

export const ETIQUETA_CLASE = { ok: "OK", ph: "PH", cartografia: "CART" };
export const TEXTO_CLASE = {
  ok: "Sin alerta · OK",
  ph: "Sin alerta · propiedad horizontal, sin evaluar",
  cartografia: "Sin alerta de imagen · la cartografía contradice el registro",
};

// Árbol de decisión de la revisión: cruza lo que dijo el sistema con lo que encontró la persona.
// Alimenta las métricas: precisión = acierto / (acierto + falso_positivo); exhaustividad = acierto / (acierto + omision).
export function tipoHallazgo(p, estado) {
  if (estado === "no_concluyente") return "no_concluyente";
  if (tieneAlerta(p)) return estado === "confirmado" ? "acierto" : estado === "descartado" ? "falso_positivo" : "";
  return estado === "confirmado" ? "omision" : estado === "descartado" ? "conforme" : "";
}
