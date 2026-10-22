const fmt = (n, u = "") =>
  n === null || n === undefined ? "dato faltante" : `${Number(n).toLocaleString("es-CO", { maximumFractionDigits: 0 })}${u}`;

const ESTADOS = [
  ["confirmado", "Confirmado"],
  ["descartado", "Descartado"],
  ["no_concluyente", "No concluyente"],
];

export default function Ficha({ p, revision, onRevisar, onCerrar, onSiguiente, progreso, centro, manifiesto, hayEvidencia }) {
  const satelite = centro && `https://www.google.com/maps/@${centro.lat.toFixed(6)},${centro.lon.toFixed(6)},19z/data=!3m1!1e3`;
  const calle = centro && `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${centro.lat.toFixed(6)},${centro.lon.toFixed(6)}`;
  const copiar = () => navigator.clipboard?.writeText(window.location.href).catch(() => {});
  return (
    <aside className="ficha" aria-label="Ficha del predio">
      <button className="cerrar" onClick={onCerrar} aria-label="Cerrar ficha">×</button>
      <h2>{p.direccion || "Sin dirección"}</h2>
      <p className="npn">{p.npn}</p>
      <div className="chips">
        <span className={`nivel ${p.nivel}`}>Puntaje {fmt(p.puntaje)}</span>
        <span className={`conf ${p.confianza}`}>Confianza {p.confianza}</span>
        {p.ph && <span className="chip">Propiedad horizontal</span>}
      </div>

      <h3>Registrado frente a observado</h3>
      <table>
        <tbody>
          <tr><th>Destino</th><td>{p.destino}</td></tr>
          <tr><th>Área de terreno (registro)</th><td>{fmt(p.area_terreno, " m²")}</td></tr>
          <tr><th>Área construida (registro)</th><td>{p.ph ? "se registra por unidad" : fmt(p.area_construida_reg, " m²")}</td></tr>
          <tr><th>Área de huella detectada</th><td>{hayEvidencia ? fmt(p.area_huella ?? 0, " m²") : "evidencia de imágenes pendiente"}</td></tr>
          <tr><th>Avalúo</th><td>{p.avaluo ? "$ " + fmt(p.avaluo) : "dato faltante"}</td></tr>
          <tr><th>Pisos</th><td>{p.pisos_usados ? fmt(p.pisos_usados) : "sin construcción registrada"}{p.altura_ilustrativa ? " (altura ilustrativa)" : ""}</td></tr>
        </tbody>
      </table>

      <h3>Por qué está marcado</h3>
      {p.razones?.length ? <ul>{p.razones.map((r) => <li key={r}>{r}</li>)}</ul> : <p>Sin alertas.</p>}

      <h3>Fuentes</h3>
      <ul className="fuentes">
        <li>Registro 1 catastral, vigencia {p.vigencia} (Alcaldía de Neiva).</li>
        <li>Cartografía predial (Alcaldía de Neiva), sistema EPSG:9377 reproyectado a EPSG:4326.</li>
        <li>Open Buildings v3 (Google Research), CC BY 4.0 / ODbL{hayEvidencia ? "" : " — no cargado"}.</li>
        {manifiesto?.generado && <li>Datos generados el {manifiesto.generado.slice(0, 10)}.</li>}
      </ul>

      {centro && (
        <>
          <h3>Verificar en imagen</h3>
          <div className="enlaces">
            <a href={satelite} target="_blank" rel="noopener noreferrer">Satélite ↗</a>
            <a href={calle} target="_blank" rel="noopener noreferrer">Street View ↗</a>
            <button onClick={copiar}>Copiar enlace</button>
          </div>
        </>
      )}

      <h3>Registrar revisión</h3>
      <div className="revision">
        {ESTADOS.map(([k, t]) => (
          <button key={k} className={revision?.estado === k ? "activo" : ""} onClick={() => onRevisar(p.npn, k)}>
            {t}
          </button>
        ))}
      </div>
      {revision && <p className="nota">Marcado como «{revision.estado}» el {revision.fecha.slice(0, 10)}.</p>}
      {progreso?.total > 0 && (
        <button className="siguiente" onClick={onSiguiente} disabled={progreso.hechos >= progreso.total}>
          Siguiente sin revisar → <span>{progreso.hechos} de {progreso.total} revisados</span>
        </button>
      )}
      <p className="aviso">Salida indicativa: prioriza qué verificar. No modifica avalúos ni genera cobros.</p>
    </aside>
  );
}
