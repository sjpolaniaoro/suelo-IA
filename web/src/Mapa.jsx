import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { GeoJsonLayer } from "@deck.gl/layers";
import { limites } from "./datos.js";

maplibregl.setWorkerUrl(workerUrl);

export const COLORES = {
  rojo: [214, 40, 40],
  naranja: [244, 140, 6],
  amarillo: [250, 204, 21],
  sin_alerta: [160, 167, 176],
};

// Mapa base abierto (OpenStreetMap vía OpenFreeMap); si falla, queda un fondo liso.
const ESTILO = "https://tiles.openfreemap.org/styles/positron";
const ESTILO_VACIO = {
  version: 8,
  sources: {},
  layers: [{ id: "fondo", type: "background", paint: { "background-color": "#e9edf0" } }],
};

export default function Mapa({ predios, huellas, filtro, seleccionado, onSeleccion }) {
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const overlay = useRef(null);
  const ajustado = useRef(false);

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
    m.addControl(new maplibregl.NavigationControl(), "top-right");
    let cayo = false;
    m.on("error", (e) => {
      if (!cayo && e?.error?.status !== undefined && m.getStyle()?.layers?.length > 1) return;
      if (!cayo && !m.isStyleLoaded()) { cayo = true; m.setStyle(ESTILO_VACIO); }
    });
    overlay.current = new MapboxOverlay({ interleaved: false, layers: [] });
    m.addControl(overlay.current);
    mapa.current = m;
    return () => m.remove();
  }, []);

  useEffect(() => {
    if (!predios || !mapa.current || ajustado.current) return;
    const [a, b] = limites(predios);
    mapa.current.fitBounds([a, b], { padding: 60, pitch: 55, bearing: -20, duration: 0 });
    ajustado.current = true;
  }, [predios]);

  useEffect(() => {
    if (!overlay.current || !predios) return;
    const pasa = (p) => filtro === "todas" || (filtro === "prioridad" ? p.puntaje > 0 : p[filtro]);
    const capas = [
      new GeoJsonLayer({
        id: "predios",
        data: predios,
        extruded: true,
        pickable: true,
        autoHighlight: true,
        highlightColor: [30, 90, 200, 140],
        getElevation: (f) => f.properties.altura,
        getFillColor: (f) => {
          const p = f.properties;
          if (f.properties.npn === seleccionado) return [30, 90, 200, 255];
          if (!pasa(p)) return [...COLORES.sin_alerta, 60];
          return [...COLORES[p.nivel], p.nivel === "sin_alerta" ? 170 : 235];
        },
        getLineColor: [255, 255, 255, 90],
        lineWidthMinPixels: 0.5,
        material: { ambient: 0.6, diffuse: 0.6, shininess: 20 },
        updateTriggers: { getFillColor: [filtro, seleccionado] },
        onClick: (info) => info.object && onSeleccion(info.object.properties.npn),
      }),
    ];
    if (huellas?.features?.length) {
      capas.push(
        new GeoJsonLayer({
          id: "huellas",
          data: huellas,
          extruded: true,
          getElevation: 3,
          getFillColor: [214, 40, 40, 120],
          getLineColor: [214, 40, 40, 255],
          lineWidthMinPixels: 1,
        })
      );
    }
    overlay.current.setProps({ layers: capas });
  }, [predios, huellas, filtro, seleccionado, onSeleccion]);

  useEffect(() => {
    if (!seleccionado || !predios || !mapa.current) return;
    const f = predios.features.find((x) => x.properties.npn === seleccionado);
    if (!f?.geometry) return;
    const [[x0, y0], [x1, y1]] = limites({ features: [f] });
    mapa.current.easeTo({ center: [(x0 + x1) / 2, (y0 + y1) / 2], zoom: 18, duration: 800 });
  }, [seleccionado, predios]);

  return <div ref={contenedor} className="mapa" role="application" aria-label="Mapa 3D del sector 02" />;
}
