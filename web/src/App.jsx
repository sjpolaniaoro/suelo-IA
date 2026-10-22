import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Mapa, { COLORES } from "./Mapa.jsx";
import Ficha from "./Ficha.jsx";
import { apiDisponible, cargarSector, fichaDesdeApi } from "./datos.js";
import { aCsv, desdeCsv, descargar, guardar, leer } from "./revisiones.js";

const FILTROS = [
  ["todas", "Todos"],
  ["prioridad", "Con alerta"],
  ["A1", "A1 · Construcción no registrada"],
  ["A2", "A2 · Área subregistrada"],
  ["A3", "A3 · Avalúo atípico"],
];

const n = (x) => (x ?? 0).toLocaleString("es-CO");

export default function App() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [api, setApi] = useState(null); // null = comprobando
  const [filtro, setFiltro] = useState("todas");
  const [sel, setSel] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [revisiones, setRevisiones] = useState(leer);
  const [guardadoOk, setGuardadoOk] = useState(true);
  const [panel, setPanel] = useState(true);
  const entrada = useRef(null);

  useEffect(() => {
    cargarSector().then(setDatos).catch((e) => setError(e.message));
    apiDisponible().then(setApi);
  }, []);

  const lista = useMemo(() => {
    if (!datos) return [];
    return datos.predios.features
      .map((f) => f.properties)
      .filter((p) => p.puntaje > 0 && (filtro === "todas" || filtro === "prioridad" || p[filtro]))
      .sort((a, b) => b.puntaje - a.puntaje)
      .slice(0, 300);
  }, [datos, filtro]);

  const elegir = useCallback((npn) => setSel(npn), []);

  useEffect(() => {
    if (!sel || !datos) return setFicha(null);
    const local = datos.predios.features.find((f) => f.properties.npn === sel)?.properties;
    setFicha(local || null);
    if (api && local) fichaDesdeApi(sel).then(setFicha).catch(() => setApi(false));
  }, [sel, datos, api]);

  const revisar = (npn, estado) => {
    const sig = { ...revisiones, [npn]: { estado, fecha: new Date().toISOString() } };
    setRevisiones(sig);
    setGuardadoOk(guardar(sig));
  };

  const exportarRevisiones = () => {
    const mapa = new Map(datos.predios.features.map((f) => [f.properties.npn, f.properties]));
    const filas = Object.entries(revisiones).map(([npn, r]) => ({ npn, ...r, ...(mapa.get(npn) || {}) , estado: r.estado, fecha: r.fecha }));
    descargar("revisiones_suelo_ia.csv", aCsv(filas, [["npn", "npn"], ["estado", "estado"], ["fecha", "fecha"], ["direccion", "direccion"], ["puntaje", "puntaje"]]));
  };
  const exportarLista = () =>
    descargar("lista_priorizada_suelo_ia.csv", aCsv(lista, [["npn", "npn"], ["direccion", "direccion"], ["puntaje", "puntaje"], ["nivel", "nivel"], ["confianza", "confianza"], ["razones", "razones"]]));

  // Carga de archivo en el navegador: nada se envía a ningún servidor.
  const cargarArchivo = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const texto = await f.text();
      if (f.name.toLowerCase().endsWith(".csv")) {
        const r = { ...revisiones, ...desdeCsv(texto) };
        setRevisiones(r);
        setGuardadoOk(guardar(r));
      } else {
        const fc = JSON.parse(texto);
        if (fc.type !== "FeatureCollection" || !fc.features?.[0]?.properties?.npn) {
          throw new Error("El GeoJSON debe ser el generado por el pipeline (propiedad npn).");
        }
        setDatos((d) => ({ ...d, predios: fc }));
        setSel(null);
      }
    } catch (err) {
      alert("No se pudo cargar el archivo: " + err.message);
    }
  };

  if (error) {
    return (
      <div className="vacio">
        <h1>Suelo-IA</h1>
        <p>No se encontraron los datos del sector ({error}). Corra el pipeline: <code>python -m pipeline.run</code>.</p>
      </div>
    );
  }
  const r = datos?.resumen;
  const hayEvidencia = r?.evidencia_imagenes;

  return (
    <div className="app">
      <button className="menu" onClick={() => setPanel(!panel)} aria-label="Mostrar u ocultar panel">☰</button>
      <section className={`panel ${panel ? "" : "oculto"}`}>
        <header>
          <h1>Suelo-IA</h1>
          <p>Priorización de revisión catastral · Neiva · sector 02</p>
        </header>

        {r && (
          <div className="cifras">
            <div><b>{n(r.predios_con_geometria)}</b><span>predios en el mapa</span></div>
            <div><b>{n(r.predios_con_alerta)}</b><span>con alerta</span></div>
            <div><b>{n(r.alertas.A1)}</b><span>A1</span></div>
            <div><b>{n(r.alertas.A2)}</b><span>A2</span></div>
            <div><b>{n(r.alertas.A3)}</b><span>A3</span></div>
            <div><b>{n(r.predios_sin_geometria)}</b><span>sin geometría</span></div>
          </div>
        )}
        {r && !hayEvidencia && <p className="aviso">Evidencia de imágenes pendiente: solo se muestra A3.</p>}
        {api === false && <p className="aviso">Modo sin conexión a la API: se usan los datos incluidos en la página.</p>}
        {!guardadoOk && <p className="aviso">El navegador no permite guardar: las revisiones se pierden al cerrar. Exporte el CSV.</p>}

        <label className="campo">
          Filtrar
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            {FILTROS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
        </label>

        <div className="leyenda" aria-label="Leyenda de colores">
          {[["rojo", "Alta"], ["naranja", "Media"], ["amarillo", "Baja"], ["sin_alerta", "Sin alerta"]].map(([k, t]) => (
            <span key={k}><i style={{ background: `rgb(${COLORES[k].join(",")})` }} />{t}</span>
          ))}
        </div>

        <ol className="lista" aria-label="Predios priorizados">
          {lista.map((p) => (
            <li key={p.npn}>
              <button className={p.npn === sel ? "sel" : ""} onClick={() => elegir(p.npn)}>
                <span className={`punto ${p.nivel}`} />
                <span className="dir">{p.direccion || p.npn}</span>
                <b>{p.puntaje}</b>
                {revisiones[p.npn] && <em>{revisiones[p.npn].estado}</em>}
              </button>
            </li>
          ))}
          {datos && lista.length === 0 && <li className="nada">Sin predios para este filtro.</li>}
        </ol>

        <footer>
          <button onClick={exportarLista} disabled={!lista.length}>Exportar lista CSV</button>
          <button onClick={exportarRevisiones} disabled={!Object.keys(revisiones).length}>Exportar revisiones CSV</button>
          <button onClick={() => entrada.current.click()}>Cargar archivo…</button>
          <input ref={entrada} type="file" accept=".geojson,.json,.csv" hidden onChange={cargarArchivo} />
          <small>
            Fuentes: Registro 1 y cartografía (Alcaldía de Neiva, vigencia 2025); Open Buildings (Google Research, CC BY 4.0 / ODbL);
            mapa base © OpenStreetMap. Salidas indicativas, sujetas a revisión humana.
          </small>
        </footer>
      </section>

      <main>
        {!datos && <div className="cargando">Cargando sector…</div>}
        <Mapa predios={datos?.predios} huellas={datos?.huellas} filtro={filtro} seleccionado={sel} onSeleccion={elegir} />
        {ficha && (
          <Ficha
            p={ficha}
            revision={revisiones[ficha.npn]}
            onRevisar={revisar}
            onCerrar={() => setSel(null)}
            manifiesto={datos?.manifiesto}
            hayEvidencia={hayEvidencia}
          />
        )}
      </main>
    </div>
  );
}
