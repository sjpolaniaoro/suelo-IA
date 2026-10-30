import { useEffect, useRef } from "react";
import { TEXTO_CLASE, claseSinAlerta } from "./clases.js";
import { DECISIONES, decisionActiva, etiquetaDecision } from "./decisiones.js";
import { ACCION, NIVEL } from "./Ficha.jsx";

// Tarjeta corta del celular: aparece al tocar un predio y deja el mapa a la vista. Trae lo justo para decidir
// (qué se detectó y los cuatro botones); la ficha completa se abre con el botón o deslizando hacia arriba.
// Deslizar hacia abajo la cierra.
export default function TarjetaMovil({ p, revision, puedeDecidir, seleccion = {}, hayCambio = false, onElegir, onEnviar, onExpandir, onCerrar, onMover, posicion }) {
  const inicio = useRef(null);
  const clase = claseSinAlerta(p);
  const activa = decisionActiva(seleccion);
  const raiz = useRef(null);
  useEffect(() => {
    raiz.current?.scrollTo({ top: 0 }); // cada predio nuevo se ve desde arriba
  }, [p.npn]);
  const nivel = clase ? TEXTO_CLASE[clase] : `${NIVEL[p.nivel]}${p.NR ? "" : ` · ${p.puntaje}`}`;
  const razon = p.razones?.[0] || "Sin alertas.";

  const alTocar = (e) => { inicio.current = e.touches[0].clientY; };
  const alSoltar = (e) => {
    if (inicio.current === null) return;
    const dy = e.changedTouches[0].clientY - inicio.current;
    inicio.current = null;
    if (dy < -40) onExpandir();
    else if (dy > 70) onCerrar();
  };

  return (
    <aside ref={raiz} className={`tarjeta-movil nivel-${p.nivel}`} aria-label="Resumen del predio" onTouchStart={alTocar} onTouchEnd={alSoltar}>
      <button type="button" className="tarjeta-asa" onClick={onExpandir} aria-label="Ver la ficha completa">
        <i aria-hidden="true" />
      </button>
      <div className="tarjeta-cab">
        <button type="button" onClick={() => onMover(-1)} disabled={!posicion?.ok} aria-label="Predio anterior">‹</button>
        <span className="tarjeta-pos">{posicion?.texto}</span>
        <button type="button" onClick={() => onMover(1)} disabled={!posicion?.ok} aria-label="Predio siguiente">›</button>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="tarjeta-cerrar">×</button>
      </div>
      <h2 className="tarjeta-dir">{p.direccion || "Sin dirección"}</h2>
      <div className="chips">
        <span className={`chip-nivel ${p.nivel}`}>{nivel}</span>
        {p.accion && <span className={`chip chip-accion ${p.accion}`}>{ACCION[p.accion]}</span>}
        {p.cons === "inconsistente" && <span className="chip chip-cons">Registro ≠ cartografía</span>}
      </div>
      <p className="tarjeta-razon">{razon}</p>
      <div className="veredictos">
        {DECISIONES.map((d) => (
          <button key={`${d.k}-${d.motivo ?? ""}`} className={`${d.k} ${activa === d ? "activo" : ""}`} aria-pressed={activa === d} disabled={!puedeDecidir}
            onClick={() => onElegir({ estado: d.k, motivo: d.motivo ?? null })} title={d.ayuda}>
            {d.t}
          </button>
        ))}
      </div>
      <button type="button" className="enviar-registro" disabled={!puedeDecidir || !hayCambio} onClick={onEnviar}>
        {revision && !hayCambio ? "Registro enviado ✓" : revision ? "Enviar cambio" : "Enviar registro"}
      </button>
      {!puedeDecidir && <p className="nota aviso-id" role="note">Identifícate arriba para decidir (invitado o funcionario).</p>}
      {revision && <p className="nota">Marcado «{etiquetaDecision(revision)}».</p>}
      <button type="button" className="tarjeta-mas" onClick={onExpandir}>Ver ficha completa ▲</button>
    </aside>
  );
}
