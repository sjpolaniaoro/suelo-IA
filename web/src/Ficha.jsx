const fmt = (n, u = "") =>
  n === null || n === undefined ? "dato faltante" : `${Number(n).toLocaleString("es-CO", { maximumFractionDigits: 0 })}${u}`;

export const VEREDICTOS = [
  { k: "confirmado", t: "Confirmado", tecla: "C", ayuda: "Hay diferencia entre el registro y lo construido" },
  { k: "descartado", t: "Descartado", tecla: "D", ayuda: "No hay diferencia" },
  { k: "no_concluyente", t: "No concluyente", tecla: "N", ayuda: "No alcanza para decidir" },
];
const ACCION = { oficina: "Conciliar en oficina", campo: "Verificar en campo" };
const TRIANGULO = {
  dos_fuentes: "La cartografía oficial y la imagen coinciden entre sí y contradicen el registro.",
  solo_cartografia: "Solo la cartografía oficial contradice el registro; la imagen no lo confirma.",
  solo_imagen: "Solo la imagen contradice el registro; la cartografía oficial no lo respalda.",
  sin_evidencia: "Ni la cartografía ni la imagen contradicen el registro (probable lote vacío).",
};
const NIVEL = { rojo: "Prioridad alta", naranja: "Prioridad media", amarillo: "Prioridad baja", no_residencial: "Revisar destino", sin_alerta: "Sin alerta" };

export default function Ficha({
  p, revision, onDecidir, onQuitar, onCerrar, onSiguiente, onMover, posicion, progreso,
  centro, manifiesto, hayEvidencia, auto, onAuto,
}) {
  const satelite = centro && `https://www.google.com/maps/@${centro.lat.toFixed(6)},${centro.lon.toFixed(6)},19z/data=!3m1!1e3`;
  const calle = centro && `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${centro.lat.toFixed(6)},${centro.lon.toFixed(6)}`;
  const copiar = () => navigator.clipboard?.writeText(window.location.href).catch(() => {});

  const reg = p.area_construida_reg ?? 0;
  const obs = p.area_huella ?? 0;
  const cart = p.area_cart ?? 0;
  const escala = Math.max(reg, obs, cart, 1);
  const verBarras = hayEvidencia && !p.ph;
  const hecho = !!revision;

  return (
    <aside className={`ficha nivel-${p.nivel}`} aria-label="Ficha del predio">
      <header className="ficha-cab">
        <div className="ficha-nav">
          <button onClick={() => onMover(-1)} disabled={!posicion?.ok} aria-label="Predio anterior" title="Anterior (K)">‹</button>
          <span>{posicion?.texto}</span>
          <button onClick={() => onMover(1)} disabled={!posicion?.ok} aria-label="Predio siguiente" title="Siguiente (J)">›</button>
          <button className="cerrar" onClick={onCerrar} aria-label="Cerrar ficha" title="Cerrar (Esc)">×</button>
        </div>
        <p className="ficha-rotulo">Hoja de revisión predial</p>
        <h2>{p.direccion || "Sin dirección"}</h2>
        <p className="npn">{p.npn}</p>
        <div className="chips">
          <span className={`chip-nivel ${p.nivel}`}>{NIVEL[p.nivel]}{p.NR ? " · sin puntaje de vivienda" : ` · ${fmt(p.puntaje)}`}</span>
          <span className={`chip ${p.confianza === "baja" ? "baja" : ""}`}>Confianza {p.confianza}</span>
          {p.ph && <span className="chip">Propiedad horizontal</span>}
          {p.accion && <span className={`chip chip-accion ${p.accion}`}>{ACCION[p.accion]}</span>}
          {["A1", "A2", "A3", "NR"].filter((k) => p[k]).map((k) => <span key={k} className="chip chip-alerta">{k}</span>)}
        </div>
      </header>

      <ol className="ficha-pasos">
        <li>
          <div className="paso-cab"><span className="paso-num">1</span><h3>Qué se detectó</h3></div>
          {p.razones?.length ? <ul className="razones">{p.razones.map((r) => <li key={r}>{r}</li>)}</ul> : <p className="suave">Sin alertas.</p>}
          {p.NR && (
            <p className="aviso-destino">
              Uso probablemente no residencial: el registro dice Habitacional sin área construida, pero la huella detectada
              es muy grande para una vivienda. Verifique el uso real y, si corresponde, el destino y el área construida.
              No cuenta en el puntaje de vivienda.
            </p>
          )}
          {verBarras ? (
            <div className="barras">
              <div className="barra"><span>Registrado</span><i className="reg" style={{ width: `${Math.max(2, (reg / escala) * 100)}%` }} /><b>{fmt(reg, " m²")}</b></div>
              {p.triangulacion && (
                <div className="barra"><span>Cartografía</span><i className="cart" style={{ width: `${Math.max(2, (cart / escala) * 100)}%` }} /><b>{fmt(cart, " m²")}</b></div>
              )}
              <div className="barra"><span>Imagen</span><i className="obs" style={{ width: `${Math.max(2, (obs / escala) * 100)}%` }} /><b>{fmt(obs, " m²")}</b></div>
            </div>
          ) : (
            <p className="suave">{p.ph ? "El área de propiedad horizontal se registra por unidad." : "Evidencia de imágenes pendiente."}</p>
          )}
          {p.triangulacion && TRIANGULO[p.triangulacion] && <p className="triangulo">{TRIANGULO[p.triangulacion]}</p>}
          <dl className="datos">
            <dt>Destino</dt><dd>{p.destino}</dd>
            <dt>Terreno</dt><dd>{fmt(p.area_terreno, " m²")}</dd>
            <dt>Avalúo</dt><dd>{p.avaluo ? "$ " + fmt(p.avaluo) : "dato faltante"}</dd>
            <dt>Pisos</dt><dd>{p.pisos_usados ? fmt(p.pisos_usados) : "sin construcción registrada"}{p.altura_ilustrativa ? " (ilustrativa)" : ""}</dd>
          </dl>
        </li>

        <li>
          <div className="paso-cab"><span className="paso-num">2</span><h3>Verificar en imagen</h3></div>
          {centro ? (
            <div className="enlaces">
              <a href={satelite} target="_blank" rel="noopener noreferrer">Satélite ↗</a>
              <a href={calle} target="_blank" rel="noopener noreferrer">Street View ↗</a>
              <button onClick={copiar}>Copiar enlace</button>
            </div>
          ) : <p className="suave">Este predio no tiene geometría para ubicarlo.</p>}
        </li>

        <li className={hecho ? "hecho" : ""}>
          <div className="paso-cab"><span className="paso-num">{hecho ? "✓" : "3"}</span><h3>Decidir</h3></div>
          <div className="veredictos">
            {VEREDICTOS.map((v) => (
              <button key={v.k} className={`${v.k} ${revision?.estado === v.k ? "activo" : ""}`} aria-pressed={revision?.estado === v.k} onClick={() => onDecidir(p.npn, v.k)} title={v.ayuda}>
                {v.t}<kbd>{v.tecla}</kbd>
              </button>
            ))}
          </div>
          {revision && (
            <p className="nota">
              Marcado «{VEREDICTOS.find((v) => v.k === revision.estado)?.t}» el {revision.fecha.slice(0, 10)}{revision.revisor ? ` por ${revision.revisor}` : ""}.{" "}
              <button className="enlace" onClick={() => onQuitar(p.npn)}>Quitar</button>
            </p>
          )}
        </li>
      </ol>

      <footer className="ficha-pie">
        {progreso?.total > 0 && (
          <button className="siguiente" onClick={onSiguiente} disabled={progreso.hechos >= progreso.total}>
            Siguiente sin revisar <span>→</span>
            <small>{progreso.hechos} de {progreso.total} revisados</small>
          </button>
        )}
        <label className="auto"><input type="checkbox" checked={auto} onChange={(e) => onAuto(e.target.checked)} /> Avanzar al siguiente al decidir</label>
        <p className="atajos">Atajos: <kbd>C</kbd> confirmar · <kbd>D</kbd> descartar · <kbd>N</kbd> no concluyente · <kbd>S</kbd> siguiente sin revisar · <kbd>J</kbd>/<kbd>K</kbd> mover · <kbd>Esc</kbd> cerrar</p>
        <details className="fuentes">
          <summary>Fuentes y fechas</summary>
          <ul>
            <li>Registro 1 catastral, vigencia {p.vigencia} (Alcaldía de Neiva).</li>
            <li>Cartografía predial (Alcaldía de Neiva), EPSG:9377 reproyectado a EPSG:4326.</li>
            <li>Open Buildings v3 (Google Research), CC BY 4.0 / ODbL{hayEvidencia ? "" : " — no cargado"}.</li>
            {manifiesto?.generado && <li>Datos generados el {manifiesto.generado.slice(0, 10)}.</li>}
          </ul>
        </details>
        <p className="aviso">Salida indicativa: prioriza qué verificar. No modifica avalúos ni genera cobros.</p>
      </footer>
    </aside>
  );
}
