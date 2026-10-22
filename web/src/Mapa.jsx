import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { GeoJsonLayer } from "@deck.gl/layers";
import { limites } from "./datos.js";

maplibregl.setWorkerUrl(workerUrl);

// Prioridad (clasificación) y estado de gestión (proceso) comparten tema con la landing.
export const COLORES = {
  rojo: [229, 72, 77],
  naranja: [244, 140, 6],
  amarillo: [250, 204, 21],
  sin_alerta: [160, 167, 176],
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
  layers: [{ id: "fondo", type: "background", paint: { "background-color": "#e9edf0" } }],
};

// En el celular el panel y la ficha tapan la parte baja: el mapa se centra en lo que queda visible.
const movil = () => window.innerWidth <= 860;
const relleno = () => (movil() ? { top: 70, left: 20, right: 20, bottom: Math.round(window.innerHeight * 0.6) } : 60);

export function pasaFiltros(p, filtros) {
  if (!(p.puntaje > 0)) return false;
  return (filtros.tipo === "todas" || p[filtros.tipo]) && filtros.niveles.has(p.nivel);
}

export default function Mapa({ predios, huellas, filtros, estados, seleccionado, onSeleccion }) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const overlay = useRef(null);
  const limitesSector = useRef(null);
  const [vista, setVista] = useState("3d");

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
        const p = object.properties;
        const lineas = [`<b>${p.direccion || p.npn}</b>`];
        lineas.push(p.puntaje > 0 ? `Prioridad ${p.nivel === "rojo" ? "alta" : p.nivel === "naranja" ? "media" : "baja"} · puntaje ${p.puntaje}` : "Sin alerta");
        return {
          html: lineas.join("<br>"),
          style: { background: "#0C1824", color: "#fff", fontSize: "12px", padding: "6px 10px", borderRadius: "8px", fontFamily: "IBM Plex Sans, system-ui, sans-serif" },
        };
      },
    });
    m.addControl(overlay.current);
    mapa.current = m;
    return () => m.remove();
  }, []);

  useEffect(() => {
    if (!predios || !mapa.current || limitesSector.current) return;
    limitesSector.current = limites(predios);
    mapa.current.fitBounds(limitesSector.current, { padding: relleno(), pitch: 55, bearing: -20, duration: 0 });
  }, [predios]);

  useEffect(() => {
    if (!overlay.current || !predios) return;
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
          if (est && COLORES_ESTADO[est]) return [...COLORES_ESTADO[est], 235];
          if (p.puntaje > 0 && !pasaFiltros(p, filtros)) return [...COLORES.sin_alerta, 55];
          return [...COLORES[p.nivel], p.nivel === "sin_alerta" ? 170 : 235];
        },
        getLineColor: [255, 255, 255, 90],
        lineWidthMinPixels: 0.5,
        material: { ambient: 0.6, diffuse: 0.6, shininess: 20 },
        updateTriggers: { getFillColor: [filtros, estados, seleccionado], getElevation: [vista] },
        onClick: (info) => info.object && onSeleccion(info.object.properties.npn),
      }),
    ];
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
    overlay.current.setProps({ layers: capas });
  }, [predios, huellas, filtros, estados, seleccionado, onSeleccion, vista]);

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
      <div ref={contenedor} className="mapa" role="application" aria-label="Mapa 3D del sector 02" />
      <div className="mapa-controles" role="group" aria-label="Vista del mapa">
        <div className="segmento">
          <button className={vista === "3d" ? "on" : ""} onClick={() => cambiarVista("3d")}>3D</button>
          <button className={vista === "2d" ? "on" : ""} onClick={() => cambiarVista("2d")}>Cenital</button>
        </div>
        <button className="pildora" onClick={recentrar}>Ver todo el sector</button>
      </div>
    </>
  );
}
