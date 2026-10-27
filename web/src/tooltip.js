// Texto del tooltip del mapa. Es texto plano a propósito: deck.gl asigna `html` a innerHTML sin sanear,
// así que un valor del GeoJSON (por ejemplo una dirección con una etiqueta) se ejecutaría. Con `text`
// el navegador lo muestra literal.
export function textoTooltip(p) {
  const lineas = [String(p.direccion || p.npn)];
  lineas.push(
    p.NR
      ? "Revisar destino (uso probablemente no residencial)"
      : p.puntaje > 0
        ? `Prioridad ${p.nivel === "rojo" ? "alta" : p.nivel === "naranja" ? "media" : "baja"} · puntaje ${p.puntaje}`
        : "Sin alerta",
  );
  if (p.accion) lineas.push(p.accion === "campo" ? "Verificar en campo" : "Conciliar en oficina");
  return lineas.join("\n");
}
