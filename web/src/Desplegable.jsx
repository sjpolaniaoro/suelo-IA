import { useEffect, useId, useRef, useState } from "react";

// Botón de la barra superior que abre un panel flotante. Solo uno abierto a la vez (lo controla el padre
// con `abierto` / `onAbrir`); se cierra con Esc, con clic fuera o al volver a pulsar el botón.
// En pantallas angostas el panel se fija bajo el botón y ocupa todo el ancho, para que no lo recorte
// la barra de filtros, que allí se desplaza en horizontal.
export default function Desplegable({ id, etiqueta, valor, activo = false, insignia, abierto, onAbrir, alineado = "izq", children }) {
  const boton = useRef(null);
  const raiz = useRef(null);
  const panelId = useId();
  const [fijo, setFijo] = useState(null);
  const esAbierto = abierto === id;

  useEffect(() => {
    if (!esAbierto) return undefined;
    const fuera = (e) => { if (!raiz.current?.contains(e.target)) onAbrir(null); };
    const tecla = (e) => { if (e.key === "Escape") { onAbrir(null); boton.current?.focus(); } };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [esAbierto, onAbrir]);

  const alternar = () => {
    if (!esAbierto && window.innerWidth <= 860) {
      setFijo({ top: Math.round(boton.current.getBoundingClientRect().bottom + 6) });
    } else setFijo(null);
    onAbrir(esAbierto ? null : id);
  };

  return (
    <div className={`desp ${esAbierto ? "abierto" : ""}`} ref={raiz}>
      <button
        ref={boton}
        type="button"
        className={`desp-boton ${activo ? "activo" : ""}`}
        aria-expanded={esAbierto}
        aria-controls={panelId}
        onClick={alternar}
      >
        <span className="desp-etiqueta">{etiqueta}</span>
        {valor && <b className="desp-valor">{valor}</b>}
        {insignia ? <i className="desp-insignia">{insignia}</i> : null}
        <span className="desp-flecha" aria-hidden="true">▾</span>
      </button>
      {esAbierto && (
        <div id={panelId} className={`desp-panel ${alineado === "der" ? "der" : ""}`} style={fijo || undefined}>
          {children}
        </div>
      )}
    </div>
  );
}
