import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { GeoJsonLayer } from "@deck.gl/layers";
import { limites } from "./datos.js";
import { textoTooltip } from "./tooltip.js";
import { claseSinAlerta, tieneAlerta } from "./clases.js";
import { SIN_PRIORIDAD, nivelDe, pasaAccion, pasaFiltros } from "./filtros.js";

maplibregl.setWorkerUrl(workerUrl);

// Colores funcionales conservados: prioridad y estado de revisión, independientes de la marca.
export const COLORES = {
  rojo: [229, 72, 77],
  naranja: [244, 140, 6],
  amarillo: [250, 204, 21],
  no_residencial: [14, 159, 188],
  sin_alerta: [160, 167, 176],
};
// Predio sin alerta revisado en terreno u oficina y encontrado conforme.
export const COLORES_VERIFICADO_OK = [27, 122, 60];
// Predios sin alerta cuando su clase está activa en el filtro.
export const COLORES_CLASE = {
  ok: [160, 197, 166],
  ph: [176, 141, 87],
  cartografia: [43, 122, 150],
  nr: [14, 159, 188],
};
// Cola de trabajo de la triangulación: contorno azul = conciliar en oficina, tinta = verificar en campo.
export const COLORES_ACCION = {
  oficina: [43, 122, 150],
  campo: [31, 42, 34],
};
export const COLORES_ESTADO = {
  confirmado: [63, 203, 147],
  descartado: [124, 141, 160],
  no_concluyente: [139, 124, 246],
};

// Mapa base abierto (OpenStreetMap vía OpenFreeMap); si falla, queda un fondo liso.
const ESTILO = "https://tiles.openfreemap.org/styles/positron";
const ESTILO_VACIO = {
  version: 8,
  sources: {},
  layers: [{ id: "fondo", type: "background", paint: { "background-color": "#f4eddc" } }],
};

// Base cartográfica con el tema de Neiva: tierra cálida, agua en azul Magdalena y parques suaves.
const TEMA_MAPA = { tierra: "#f4eddc", agua: "#b4d3e0", cauce: "#8fbfd3", parque: "#dde6c8" };
function aplicarTema(m) {
  (m.getStyle()?.layers || []).forEach((l) => {
    try {
      if (l.type === "background") m.setPaintProperty(l.id, "background-color", TEMA_MAPA.tierra);
      else if (l.type === "fill" && /^water/.test(l.id)) m.setPaintProperty(l.id, "fill-color", TEMA_MAPA.agua);
      else if (l.type === "line" && /^waterway/.test(l.id)) m.setPaintProperty(l.id, "line-color", TEMA_MAPA.cauce);
      else if (l.type === "fill" && /^(park|landcover_(wood|grass))/.test(l.id)) m.setPaintProperty(l.id, "fill-color", TEMA_MAPA.parque);
    } catch {
      /* capa sin esa propiedad: se deja como viene */
    }
  });
}

// En el celular el panel y la ficha tapan la parte baja: el mapa se centra en lo que queda visible.
const movil = () => window.innerWidth <= 860;
const relleno = () => (movil() ? { top: 70, left: 20, right: 20, bottom: Math.round(window.innerHeight * 0.6) } : 60);

export { SIN_PRIORIDAD, nivelDe, pasaAccion, pasaFiltros };

export default function Mapa({ predios, huellas, filtros, estados, seleccionado, onSeleccion }) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const overlay = useRef(null);
  const limitesSector = useRef(null);
  const [vista, setVista] = useState("3d");
  // Verdadero cuando el control de deck.gl ya está en el mapa: recién entonces se pueden poner capas.
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const m = new maplibregl.Map({
      container: contenedor.current,
      style: ESTILO,
      center: [-75.28, 2.93],
      zoom: 14,
      pitch: 55,
      bearing: -20,
      maxPitch: 75,
      attributionControl: { compact: true, customAttribution: "Open Buildings (Google Research) · Registro 1 y cartografía: Alcaldía de Neiva" },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
    m.on("style.load", () => aplicarTema(m));
    let cayo = false;
    m.on("error", (e) => {
      if (!cayo && e?.error?.status !== undefined && m.getStyle()?.layers?.length > 1) return;
      if (!cayo && !m.isStyleLoaded()) { cayo = true; m.setStyle(ESTILO_VACIO); }
    });
    overlay.current = new MapboxOverlay({
      interleaved: false,
      layers: [],
      getTooltip: ({ object }) => {
        if (!object) return null;
        // Texto plano, no html: deck.gl asigna html a innerHTML sin sanear (ver tooltip.js).
        return {
          text: textoTooltip(object.properties),
          style: { whiteSpace: "pre-line", background: "var(--sia-surface)", color: "var(--sia-ink)", border: "1px solid var(--sia-control)", fontSize: "13px", padding: "8px 12px", borderRadius: "3px", fontFamily: "var(--sia-body)" },
        };
      },
    });
    // MapLibre puede no tener proyección mientras carga el estilo remoto o su respaldo.
    // deck.gl consulta esa proyección al añadir el control: esperar evita romper la ficha.
    const agregarOverlay = () => {
      m.addControl(overlay.current);
      setListo(true);
    };
    if (m.isStyleLoaded()) agregarOverlay();
    else m.once("style.load", agregarOverlay);
    mapa.current = m;
    if (new URLSearchParams(window.location.search).has("debug")) window.__suelo = { mapa: m, overlay: overlay.current };
    return () => {
      m.off("style.load", agregarOverlay);
      setListo(false);
      m.remove();
      mapa.current = null;
      overlay.current = null;
    };
  }, []);

  useEffect(() => {
    if (!predios || !mapa.current || limitesSector.current) return;
    limitesSector.current = limites(predios);
    mapa.current.fitBounds(limitesSector.current, { padding: relleno(), pitch: 55, bearing: -20, duration: 0 });
  }, [predios]);

  useEffect(() => {
    if (!overlay.current || !predios || !listo) return;
    const capas = [
      new GeoJsonLayer({
        id: "predios",
        data: predios,
        extruded: vista === "3d",
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 110],
        getElevation: (f) => f.properties.altura,
        getFillColor: (f) => {
          const p = f.properties;
          if (p.npn === seleccionado) return [37, 99, 235, 255];
          const est = estados[p.npn]?.estado;
          if (est === "descartado" && !tieneAlerta(p)) return [...COLORES_VERIFICADO_OK, 255];
          if (est && COLORES_ESTADO[est]) return [...COLORES_ESTADO[est], 235];
          const vivo = pasaFiltros(p, filtros);
          if (!tieneAlerta(p)) {
            return vivo ? [...COLORES_CLASE[claseSinAlerta(p)], 235] : [...COLORES.sin_alerta, 170];
          }
          if (!vivo) return [...COLORES.sin_alerta, 55];
          return [...COLORES[p.nivel], p.nivel === "sin_alerta" ? 170 : 235];
        },
        getLineColor: [255, 255, 255, 90],
        lineWidthMinPixels: 0.5,
        material: { ambient: 0.6, diffuse: 0.6, shininess: 20 },
        updateTriggers: { getFillColor: [filtros, estados, seleccionado], getElevation: [vista] },
        onClick: (info) => info.object && onSeleccion(info.object.properties.npn),
      }),
    ];
    // Contorno según la cola de trabajo de la triangulación (solo predios que pasan los filtros).
    const marcadas = predios.features.filter((f) => f.properties.accion && pasaFiltros(f.properties, filtros));
    capas.push(
      new GeoJsonLayer({
        id: "acciones",
        data: marcadas,
        filled: false,
        stroked: true,
        extruded: false,
        getLineColor: (f) => [...COLORES_ACCION[f.properties.accion], 255],
        getLineWidth: (f) => (f.properties.accion === "campo" ? 3 : 2),
        lineWidthUnits: "pixels",
      })
    );
    if (huellas?.features?.length && vista === "3d") {
      capas.push(
        new GeoJsonLayer({
          id: "huellas",
          data: huellas,
          extruded: true,
          getElevation: 3,
          getFillColor: [229, 72, 77, 120],
          getLineColor: [229, 72, 77, 255],
          lineWidthMinPixels: 1,
        })
      );
    }
    // No se condiciona a map.isStyleLoaded(): devuelve falso mientras cargan teselas y, si el evento
    // style.load ya pasó, las capas nunca se aplicaban y el mapa quedaba sin predios dibujados.
    overlay.current.setProps({ layers: capas });
  }, [predios, huellas, filtros, estados, seleccionado, onSeleccion, vista, listo]);

  useEffect(() => {
    if (!seleccionado || !predios || !mapa.current) return;
    const f = predios.features.find((x) => x.properties.npn === seleccionado);
    if (!f?.geometry) return;
    const [[x0, y0], [x1, y1]] = limites({ features: [f] });
    mapa.current.easeTo({ center: [(x0 + x1) / 2, (y0 + y1) / 2], zoom: 18, duration: 800, padding: movil() ? { bottom: Math.round(window.innerHeight * 0.5) } : { bottom: 0 } });
  }, [seleccionado, predios]);

  const cambiarVista = (v) => {
    setVista(v);
    mapa.current?.easeTo({ pitch: v === "3d" ? 55 : 0, bearing: v === "3d" ? -20 : 0, duration: 600 });
  };
  const recentrar = () => {
    if (limitesSector.current) mapa.current?.fitBounds(limitesSector.current, { padding: relleno(), pitch: vista === "3d" ? 55 : 0, bearing: vista === "3d" ? -20 : 0, duration: 700 });
  };

  return (
    <>
      <div ref={contenedor} className="mapa" role="application" aria-label="Mapa 3D del sector catastral 02" />
      <div className="mapa-controles" role="group" aria-label="Vista del mapa">
        <div className="segmento">
          <button className={vista === "3d" ? "on" : ""} aria-pressed={vista === "3d"} onClick={() => cambiarVista("3d")}>3D</button>
          <button className={vista === "2d" ? "on" : ""} aria-pressed={vista === "2d"} onClick={() => cambiarVista("2d")}>Cenital</button>
        </div>
        <button className="pildora" onClick={recentrar}>Ver todo el sector</button>
      </div>
    </>
  );
}
