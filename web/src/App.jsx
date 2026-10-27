import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Mapa, { COLORES, COLORES_ESTADO, pasaFiltros } from "./Mapa.jsx";
import Ficha, { VEREDICTOS } from "./Ficha.jsx";
import { apiDisponible, cargarSector, fichaDesdeApi, limites } from "./datos.js";
import { aCsv, desdeCsv, descargar, guardar, leer } from "./revisiones.js";

const NIVELES = [["rojo", "Alta"], ["naranja", "Media"], ["amarillo", "Baja"]];
const TIPOS = [["todas", "Todas"], ["A1", "A1 Construcción no registrada"], ["A2", "A2 Área subregistrada"], ["A3", "A3 Avalúo atípico"], ["NR", "NR Revisar destino (uso no residencial)"]];
const TODOS_NIVELES = new Set(NIVELES.map((x) => x[0]));
const MAX_LISTA = 400;

const n = (x) => (x ?? 0).toLocaleString("es-CO");
const rgb = (c) => `rgb(${c.join(",")})`;
const ICONO = { confirmado: "✓", descartado: "✕", no_concluyente: "?" };

function leerAuto() {
  try { return localStorage.getItem("suelo-ia-auto") !== "0"; } catch { return true; }
}

export default function App() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [api, setApi] = useState(null); // null = comprobando
  const [tipo, setTipo] = useState("todas");
  const [niveles, setNiveles] = useState(TODOS_NIVELES);
  const [etapa, setEtapa] = useState("pendientes"); // todos | pendientes | revisados | confirmado
  const [sel, setSel] = useState(() => new URLSearchParams(window.location.search).get("predio"));
  const [ficha, setFicha] = useState(null);
  const [revisiones, setRevisiones] = useState(leer);
  const [guardadoOk, setGuardadoOk] = useState(true);
  const [panel, setPanel] = useState(true);
  const [auto, setAuto] = useState(leerAuto);
  const [mostrar, setMostrar] = useState(MAX_LISTA);
  const entrada = useRef(null);

  useEffect(() => {
    cargarSector().then(setDatos).catch((e) => setError(e.message));
    apiDisponible().then(setApi);
  }, []);

  /* ---------- Clasificación: predios con alerta, ordenados por prioridad ---------- */
  const alertas = useMemo(() => {
    if (!datos) return [];
    return datos.predios.features
      .map((f) => f.properties)
      .filter((p) => p.puntaje > 0 || p.NR)
      .sort((a, b) => b.puntaje - a.puntaje || (b.area_huella ?? 0) - (a.area_huella ?? 0));
  }, [datos]);

  const filtros = useMemo(() => ({ tipo, niveles }), [tipo, niveles]);
  const base = useMemo(() => alertas.filter((p) => pasaFiltros(p, filtros)), [alertas, filtros]);

  const cuentaNivel = useMemo(() => {
    const c = { rojo: 0, naranja: 0, amarillo: 0 };
    alertas.forEach((p) => { if (!p.NR && (tipo === "todas" || p[tipo])) c[p.nivel]++; });
    return c;
  }, [alertas, tipo]);
  const cuentaTipo = useMemo(() => {
    const c = { todas: 0, A1: 0, A2: 0, A3: 0, NR: 0 };
    alertas.forEach((p) => {
      if (p.NR) { c.NR++; return; }
      if (!niveles.has(p.nivel)) return;
      c.todas++;
      ["A1", "A2", "A3"].forEach((k) => { if (p[k]) c[k]++; });
    });
    return c;
  }, [alertas, niveles]);

  /* ---------- Proceso: detectados → por revisar → revisados → confirmados ---------- */
  const etapas = useMemo(() => {
    const revisados = base.filter((p) => revisiones[p.npn]).length;
    return {
      todos: base.length,
      pendientes: base.length - revisados,
      revisados,
      confirmado: base.filter((p) => revisiones[p.npn]?.estado === "confirmado").length,
    };
  }, [base, revisiones]);

  const lista = useMemo(() => base.filter((p) => {
    const r = revisiones[p.npn];
    if (etapa === "pendientes") return !r;
    if (etapa === "revisados") return !!r;
    if (etapa === "confirmado") return r?.estado === "confirmado";
    return true;
  }), [base, revisiones, etapa]);
  const visibles = lista.slice(0, mostrar);
  useEffect(() => setMostrar(MAX_LISTA), [tipo, niveles, etapa]);

  const progreso = { hechos: etapas.revisados, total: base.length };
  const posicion = useMemo(() => {
    const i = lista.findIndex((p) => p.npn === sel);
    if (i >= 0) return { texto: `${i + 1} de ${n(lista.length)}`, ok: true };
    return { texto: revisiones[sel] ? "Ya revisado" : "Fuera de la etapa o filtros actuales", ok: lista.length > 0 };
  }, [lista, sel, revisiones]);

  const elegir = useCallback((npn) => setSel(npn), []);

  // Enlace compartible: ?predio=número abre la ficha directamente.
  useEffect(() => {
    const u = new URL(window.location.href);
    if (sel) u.searchParams.set("predio", sel);
    else u.searchParams.delete("predio");
    window.history.replaceState(null, "", u);
  }, [sel]);

  useEffect(() => {
    if (!sel || !datos) return setFicha(null);
    const local = datos.predios.features.find((f) => f.properties.npn === sel)?.properties;
    setFicha(local || null);
    if (api && local) fichaDesdeApi(sel).then(setFicha).catch(() => setApi(false));
  }, [sel, datos, api]);

  const centro = useMemo(() => {
    const f = datos?.predios.features.find((x) => x.properties.npn === sel);
    if (!f?.geometry) return null;
    const [[x0, y0], [x1, y1]] = limites({ features: [f] });
    return { lat: (y0 + y1) / 2, lon: (x0 + x1) / 2 };
  }, [datos, sel]);

  /* ---------- Navegación entre predios ---------- */
  const mover = useCallback((d) => {
    if (!lista.length) return;
    const i = lista.findIndex((p) => p.npn === sel);
    const j = i < 0 ? 0 : (i + d + lista.length) % lista.length;
    setSel(lista[j].npn);
  }, [lista, sel]);

  const siguientePendiente = useCallback((desde = sel, rev = revisiones) => {
    const i = base.findIndex((p) => p.npn === desde);
    const orden = [...base.slice(i + 1), ...base.slice(0, i + 1)];
    const sig = orden.find((p) => !rev[p.npn] && p.npn !== desde);
    if (sig) setSel(sig.npn);
  }, [base, sel, revisiones]);

  /* ---------- Decidir ---------- */
  const decidir = useCallback((npn, estado) => {
    const sig = { ...revisiones, [npn]: { estado, fecha: new Date().toISOString() } };
    setRevisiones(sig);
    setGuardadoOk(guardar(sig));
    if (auto) siguientePendiente(npn, sig);
  }, [revisiones, auto, siguientePendiente]);

  const quitar = (npn) => {
    const sig = { ...revisiones };
    delete sig[npn];
    setRevisiones(sig);
    setGuardadoOk(guardar(sig));
  };

  const cambiarAuto = (v) => {
    setAuto(v);
    try { localStorage.setItem("suelo-ia-auto", v ? "1" : "0"); } catch { /* sin almacenamiento */ }
  };

  /* ---------- Atajos de teclado ---------- */
  useEffect(() => {
    const alTecla = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t.closest?.("input, select, textarea, [contenteditable]")) return;
      const k = e.key.toLowerCase();
      if (k === "escape") return setSel(null);
      if (!sel) return;
      if (k === "j" || k === "arrowdown") { e.preventDefault(); mover(1); }
      else if (k === "k" || k === "arrowup") { e.preventDefault(); mover(-1); }
      else if (k === "s") siguientePendiente();
      else {
        const v = { c: "confirmado", d: "descartado", n: "no_concluyente" }[k];
        if (v) decidir(sel, v);
      }
    };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [sel, mover, siguientePendiente, decidir]);

  /* ---------- Exportar y cargar ---------- */
  const exportarRevisiones = () => {
    const mapa = new Map(datos.predios.features.map((f) => [f.properties.npn, f.properties]));
    const filas = Object.entries(revisiones).map(([npn, r]) => ({ ...(mapa.get(npn) || {}), npn, estado: r.estado, fecha: r.fecha }));
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

  const alternarNivel = (k) => {
    const s = new Set(niveles);
    if (s.has(k)) s.delete(k); else s.add(k);
    setNiveles(s.size ? s : TODOS_NIVELES);
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
  const pct = base.length ? (etapas.revisados / base.length) * 100 : 0;

  return (
    <div className={`app ${sel ? "con-ficha" : ""}`}>
      <button className="menu" onClick={() => setPanel(!panel)} aria-label="Mostrar u ocultar panel" aria-expanded={panel}>☰</button>
      <section className={`panel ${panel ? "" : "oculto"}`}>
        <header className="panel-cab">
          <a className="marca" href="/" aria-label="Suelo-IA, volver al inicio">
            <img src="/favicon.svg" width="36" height="36" alt="" className="marca-logo" />
            <span>Suelo-IA</span>
          </a>
          <span className="sector">Sector 02 · Neiva</span>
          <a className="inicio" href="/">← Inicio</a>
        </header>

        <div className="panel-cuerpo">
          {/* Proceso de gestión */}
          <section className="proceso" aria-label="Proceso de revisión">
            <p className="eyebrow">Proceso de revisión</p>
            <ol className="etapas" style={{ "--progreso": pct / 100 }}>
              {[
                ["todos", "Detectados", etapas.todos],
                ["pendientes", "Por revisar", etapas.pendientes],
                ["revisados", "Revisados", etapas.revisados],
                ["confirmado", "Confirmados", etapas.confirmado],
              ].map(([k, t, c], i) => (
                <li key={k}>
                  <button className={etapa === k ? "on" : ""} aria-pressed={etapa === k} onClick={() => setEtapa(k)}>
                    <span className="nodo">{n(c)}</span>
                    <span className="etapa-nombre"><i>{i + 1}</i> {t}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="barra-avance" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(pct)} aria-label="Avance de revisión">
              <i style={{ width: `${pct}%` }} />
            </div>
            <p className="avance-texto" aria-live="polite">
              {n(etapas.revisados)} de {n(base.length)} predios revisados
              {etapas.pendientes === 0 && base.length > 0 ? " · ¡cola completa!" : ""}
            </p>
          </section>

          {/* Clasificación */}
          <details className="clasificacion" open={typeof window !== "undefined" && window.innerWidth > 860}>
            <summary>Clasificación y filtros</summary>
            <p className="etiqueta">Prioridad</p>
            <div className="fichas" role="group" aria-label="Prioridad">
              {NIVELES.map(([k, t]) => (
                <button key={k} className={niveles.has(k) ? "on" : ""} aria-pressed={niveles.has(k)} onClick={() => alternarNivel(k)}>
                  <i style={{ background: rgb(COLORES[k]) }} />{t} <b>{n(cuentaNivel[k])}</b>
                </button>
              ))}
            </div>
            <p className="etiqueta">Tipo de alerta</p>
            <div className="fichas tipos" role="group" aria-label="Tipo de alerta">
              {TIPOS.map(([k, t]) => (
                <button key={k} className={tipo === k ? "on" : ""} aria-pressed={tipo === k} onClick={() => setTipo(k)} title={t}>
                  {k === "todas" ? "Todas" : k} <b>{n(cuentaTipo[k])}</b>
                </button>
              ))}
            </div>
            <div className="leyenda" aria-label="Colores del mapa">
              <span><i style={{ background: rgb(COLORES_ESTADO.confirmado) }} />Confirmado</span>
              <span><i style={{ background: rgb(COLORES_ESTADO.descartado) }} />Descartado</span>
              <span><i style={{ background: rgb(COLORES_ESTADO.no_concluyente) }} />No concluyente</span>
              <span><i style={{ background: rgb(COLORES.no_residencial) }} />Revisar destino (NR)</span>
              <span><i style={{ background: rgb(COLORES.sin_alerta) }} />Sin alerta</span>
            </div>
          </details>

          {r && !hayEvidencia && <p className="aviso">Evidencia de imágenes pendiente: solo se muestra A3.</p>}
          {api === false && <p className="aviso">Modo sin conexión a la API: se usan los datos incluidos en la página.</p>}
          {!guardadoOk && <p className="aviso">El navegador no permite guardar: las revisiones se pierden al cerrar. Exporte el CSV.</p>}

          <ol className="lista" aria-label="Predios de la etapa seleccionada">
            {visibles.map((p) => {
              const rev = revisiones[p.npn];
              const tipos = ["A1", "A2", "A3", "NR"].filter((k) => p[k]).join(" · ");
              return (
                <li key={p.npn}>
                  <button className={`${p.npn === sel ? "sel" : ""} n-${p.nivel}`} onClick={() => elegir(p.npn)}>
                    <span className="dir">{p.direccion || p.npn}</span>
                    <span className="meta">{tipos}{p.area_huella ? ` · ${n(Math.round(p.area_huella))} m²` : ""}{p.confianza === "baja" ? " · conf. baja" : ""}</span>
                    <b className="pt">{p.NR ? "NR" : p.puntaje}</b>
                    {rev && <em className={`est ${rev.estado}`} title={rev.estado}>{ICONO[rev.estado]}</em>}
                  </button>
                </li>
              );
            })}
            {datos && lista.length === 0 && (
              <li className="nada">
                {etapa === "pendientes" && base.length > 0 ? "No quedan predios por revisar con estos filtros." : "Sin predios en esta etapa."}
              </li>
            )}
            {lista.length > visibles.length && (
              <li><button className="mas" onClick={() => setMostrar(mostrar + MAX_LISTA)}>Mostrar {n(Math.min(MAX_LISTA, lista.length - visibles.length))} más de {n(lista.length - visibles.length)}</button></li>
            )}
          </ol>
        </div>

        <footer className="panel-pie">
          <details className="pie-menu" open={typeof window !== "undefined" && window.innerWidth > 860}>
            <summary>Exportar, cargar y créditos</summary>
            <div className="acciones">
              <button onClick={exportarLista} disabled={!lista.length}>Exportar lista</button>
              <button onClick={exportarRevisiones} disabled={!Object.keys(revisiones).length}>Exportar revisiones</button>
              <button onClick={() => entrada.current.click()}>Cargar…</button>
            </div>
            <input ref={entrada} type="file" accept=".geojson,.json,.csv" hidden onChange={cargarArchivo} />
            <small>
              Registro 1 y cartografía (Alcaldía de Neiva, vigencia 2025); Open Buildings (Google Research, CC BY 4.0 / ODbL);
              mapa base © OpenStreetMap. Salidas indicativas, sujetas a revisión humana.
            </small>
          </details>
        </footer>
      </section>

      <main>
        {!datos && <div className="cargando">Cargando sector…</div>}
        <Mapa predios={datos?.predios} huellas={datos?.huellas} filtros={filtros} estados={revisiones} seleccionado={sel} onSeleccion={elegir} />
        {ficha && (
          <Ficha
            p={ficha}
            revision={revisiones[ficha.npn]}
            onDecidir={decidir}
            onQuitar={quitar}
            onCerrar={() => setSel(null)}
            onSiguiente={() => siguientePendiente()}
            onMover={mover}
            posicion={posicion}
            progreso={progreso}
            centro={centro}
            manifiesto={datos?.manifiesto}
            hayEvidencia={hayEvidencia}
            auto={auto}
            onAuto={cambiarAuto}
          />
        )}
      </main>
    </div>
  );
}
