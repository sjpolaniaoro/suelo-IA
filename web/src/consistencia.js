// Contraste entre las tres fuentes de un predio: Registro 1, cartografía oficial e imagen (Open Buildings).
// Solo hace aritmética sobre las cifras del pipeline (áreas en m²); los umbrales vienen de
// `resumen.umbrales_consistencia`, que el pipeline copia de pipeline/config.yaml.
// Nada de esto cambia el puntaje ni las alertas: es lo que la ficha muestra para explicar el error.

// Respaldo si el resumen no trae los umbrales (valores actuales de config.yaml).
export const UMBRALES = { factor_area: 1.2, cartografia_min_m2: 10 };

const num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : null);
export const m2 = (x) => `${Math.round(x).toLocaleString("es-CO")} m²`;
const con_signo = (x) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${m2(Math.abs(x))}`;

// Porcentaje de coincidencia entre dos áreas: la menor sobre la mayor (100 % = iguales).
export const concordancia = (a, b) => {
  const mayor = Math.max(a, b);
  return mayor === 0 ? 100 : Math.round((Math.min(a, b) / mayor) * 100);
};

// Registro frente a cartografía: ambas son área construida, por eso se compara en los dos sentidos.
function parRegCart(reg, cart, u) {
  const diff = cart - reg;
  const discrepa = Math.abs(diff) >= u.cartografia_min_m2 && (cart > u.factor_area * reg || reg > u.factor_area * cart);
  return { diff, discrepa, conc: concordancia(reg, cart), sentido: diff > 0 ? "cartografia_mayor" : diff < 0 ? "registro_mayor" : "igual" };
}

/**
 * Resultado del contraste de un predio.
 * `estado` (para filtrar y pintar): registro vs cartografía "inconsistente" | "coincide" | "no_aplica" (propiedad horizontal).
 * `pares`: las tres comparaciones con su diferencia y su porcentaje de coincidencia.
 * `diagnostico`: qué falla exactamente, en palabras; `null` si las fuentes no se contradicen.
 */
export function evaluar(p, u = UMBRALES, hayImagen = true) {
  const reg = num(p.area_construida_reg) ?? 0;
  const cart = num(p.area_cart) ?? 0;
  const img = hayImagen ? num(p.area_huella) ?? 0 : null;
  const conf = num(p.confianza_media);
  const base = {
    reg, cart, img,
    confianzaImagen: img !== null && conf !== null ? Math.round(conf * 100) : null,
    nHuellas: num(p.n_huellas),
  };
  if (p.ph) return { ...base, estado: "no_aplica", pares: null, diagnostico: null };

  const rc = parRegCart(reg, cart, u);
  // La imagen contradice el registro solo cuando la regla del pipeline (A1, A2 o NR) la dio por válida.
  const imagenContradice = !!(p.A1 || p.A2 || p.NR);
  const pares = {
    regCart: rc,
    regImg: img === null ? null : { diff: img - reg, discrepa: imagenContradice, conc: concordancia(reg, img) },
    cartImg: img === null ? null : { diff: img - cart, conc: concordancia(cart, img), coinciden: p.triangulacion === "dos_fuentes" },
  };
  // El estado es solo registro vs cartografía (lo que filtra y se pinta); la imagen ya tiene sus alertas A1 a A3.
  const estado = rc.discrepa ? "inconsistente" : "coincide";
  return { ...base, estado, pares, diagnostico: diagnosticar(p, base, pares) };
}

function diagnosticar(p, { reg, cart, img, confianzaImagen }, { regCart }) {
  const conf = confianzaImagen === null ? "" : ` (confianza ${confianzaImagen} %)`;
  const t = p.triangulacion;
  if (t === "dos_fuentes") {
    return {
      nivel: "alto",
      titulo: "El registro contradice a las otras dos fuentes",
      detalle: `La cartografía (${m2(cart)}) y la imagen (${m2(img ?? 0)}${conf}) coinciden entre sí; el registro declara ${m2(reg)}, ${m2(Math.abs(cart - reg))} menos que la cartografía.`,
    };
  }
  if (t === "solo_cartografia") {
    return {
      nivel: "medio",
      titulo: "Registro y cartografía discrepan; la imagen no lo confirma",
      detalle: `La cartografía dibuja ${m2(cart)} y el registro ${m2(reg)} (${con_signo(regCart.diff)}). La imagen no alcanza a confirmarlo: detecta ${m2(img ?? 0)}${conf}.`,
    };
  }
  if (t === "solo_imagen") {
    return {
      nivel: "medio",
      titulo: "Solo la imagen contradice el registro",
      detalle: `La imagen detecta ${m2(img ?? 0)}${conf} frente a ${m2(reg)} registrados, pero la cartografía dibuja ${m2(cart)} y no lo respalda.`,
    };
  }
  if (t === "sin_evidencia") {
    return {
      nivel: "bajo",
      titulo: "Ninguna fuente contradice el registro",
      detalle: `Registro ${m2(reg)}, cartografía ${m2(cart)} e imagen ${m2(img ?? 0)}: sin construcción en ninguna fuente (probable lote vacío).`,
    };
  }
  if (regCart.discrepa) {
    const mayor = regCart.sentido === "cartografia_mayor";
    return {
      nivel: "medio",
      titulo: mayor ? "La cartografía dibuja más que el registro" : "El registro declara más que la cartografía",
      detalle: `Registro ${m2(reg)} frente a cartografía ${m2(cart)} (${con_signo(regCart.diff)}, coinciden ${regCart.conc} %). La imagen no genera alerta, por eso no entra en una cola de revisión.`,
    };
  }
  return null;
}

// Agrega `cons` (estado del contraste) a cada predio para filtrar y pintar sin recalcular. Solo en memoria.
export function enriquecer(fc, u = UMBRALES, hayImagen = true) {
  for (const f of fc.features) f.properties.cons = evaluar(f.properties, u, hayImagen).estado;
  return fc;
}
