"""Orquesta el pipeline de Suelo-IA v1 y escribe los datos del sector.

Uso:
    python -m pipeline.run                       # usa data/raw/
    python -m pipeline.run --registro X --terrenos Y --construcciones Z --huellas W
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely
import yaml
from shapely.geometry import mapping

from . import alertas, cartografia, evidencia, registro1

RAIZ = Path(__file__).resolve().parent.parent
RAW = RAIZ / "data" / "raw"


class ControlError(RuntimeError):
    """Un conteo no coincide con las cifras de control del spec."""


def sha256(ruta: Path) -> str:
    h = hashlib.sha256()
    with open(ruta, "rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def verificar(nombre: str, obtenido: int, esperado: int, estricto: bool) -> None:
    ok = obtenido == esperado
    print(f"  control {nombre}: {obtenido:,} (spec {esperado:,}) {'OK' if ok else 'NO COINCIDE'}")
    if not ok and estricto:
        raise ControlError(f"{nombre}: se obtuvo {obtenido}, el spec indica {esperado}.")


def _limpio(v):
    if isinstance(v, (np.floating, float)):
        return None if np.isnan(v) else float(v)
    if isinstance(v, np.integer):
        return int(v)
    if isinstance(v, np.bool_):
        return bool(v)
    return v


def a_geojson(gdf: gpd.GeoDataFrame, props: list[str], decimales: int, tolerancia: float | None):
    g = gdf.copy()
    if tolerancia:
        g["geometry"] = g.geometry.simplify(tolerancia, preserve_topology=True)
    g["geometry"] = shapely.force_2d(g.geometry.values)
    g = g.to_crs(cartografia.CRS_WEB)
    g["geometry"] = shapely.set_precision(g.geometry.values, 10.0 ** -decimales)
    feats = []
    for fila in g[props + ["geometry"]].itertuples(index=False):
        d = fila._asdict()
        geom = d.pop("geometry")
        feats.append(
            {
                "type": "Feature",
                "properties": {k: _limpio(v) for k, v in d.items()},
                "geometry": mapping(geom),
            }
        )
    return {"type": "FeatureCollection", "features": feats}


def escribir(obj, rutas: list[Path]) -> float:
    texto = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    for r in rutas:
        r.parent.mkdir(parents=True, exist_ok=True)
        r.write_text(texto, encoding="utf-8")
    return len(texto.encode("utf-8")) / 1e6


def altura(df: pd.DataFrame, cfg: dict) -> pd.DataFrame:
    h = cfg["alturas"]
    tiene = df["n_construcciones"].fillna(0) > 0
    registrada = df["area_construida_reg"].fillna(0) > 0
    pisos = df["pisos"].where(df["pisos"] > 0)
    df["pisos_usados"] = np.where(tiene | registrada, pisos.fillna(1), 0)
    df["altura_ilustrativa"] = (tiene | registrada) & pisos.isna()
    df["altura"] = np.where(
        tiene | registrada, df["pisos_usados"] * h["metros_por_piso"], h["altura_sin_construccion_m"]
    )
    return df


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--config", default=str(RAIZ / "pipeline" / "config.yaml"))
    p.add_argument("--registro", default=str(RAW / "CATASTRAL_REGISTRO1_20250505.xlsx"))
    p.add_argument("--terrenos", default=str(RAW / "Unidad_Espacial" / "Terrenos.shp"))
    p.add_argument("--construcciones", default=str(RAW / "Unidad_Espacial" / "Construccion.shp"))
    p.add_argument("--huellas", default=str(RAW / "open_buildings_neiva.csv"))
    p.add_argument("--salida-web", default=str(RAIZ / "web" / "public" / "data"))
    p.add_argument("--salida-api", default=str(RAIZ / "api" / "data"))
    p.add_argument("--sin-control", action="store_true", help="solo para pruebas con datos sintéticos")
    a = p.parse_args(argv)

    cfg = yaml.safe_load(open(a.config, encoding="utf-8"))
    estricto = not a.sin_control
    zona, sector = cfg["sector"]["zona"], cfg["sector"]["sector"]
    ctl = cfg["control"]

    print("1/6 Registro 1")
    r1 = registro1.cargar(a.registro, cfg["prohibidas"])
    print(f"  filas {r1.attrs['filas_crudas']:,}; predios únicos {r1.attrs['predios_unicos']:,}")
    sec = registro1.recortar_sector(r1, zona, sector)
    hab = registro1.habitacionales_no_ph(sec)
    verificar("habitacionales no PH", len(hab), ctl["predios_habitacionales_no_ph"], estricto)
    verificar("sin área construida", int((hab["area_construida_reg"] == 0).sum()),
              ctl["predios_sin_area_construida"], estricto)

    print("2/6 Cartografía")
    terrenos = cartografia.cargar_terrenos(a.terrenos, zona, sector)
    verificar("terrenos del sector", terrenos.attrs["terrenos_sector"], ctl["terrenos_sector"], estricto)
    pisos = cartografia.pisos_por_terreno(a.construcciones, set(terrenos["llave21"]))
    geo, sin_geo, tasa = cartografia.cruzar(sec, terrenos, pisos)
    print(f"  cruce con terreno: {tasa:.1%} ({len(sin_geo):,} predios sin geometría)")
    if tasa < ctl["tasa_cruce_minima"]:
        raise ControlError(
            f"La tasa de cruce ({tasa:.1%}) es menor al mínimo {ctl['tasa_cruce_minima']:.0%}."
        )
    geo["terreno_m2"] = geo.geometry.area

    print("3/6 Evidencia de imágenes")
    hay_huellas = Path(a.huellas).exists()
    cortes = None
    if hay_huellas:
        h = evidencia.cargar_huellas(a.huellas, cfg["alertas"]["A1"]["confianza_min"])
        ev, cortes = evidencia.asignar(h, terrenos)
        geo = geo.merge(ev, on="llave21", how="left")
        print(f"  huellas usadas: {len(h):,}; terrenos con huella: {len(ev):,}")
    else:
        print("  Open Buildings no disponible: solo se calcula A3.")
        for c in ("area_huella", "n_huellas", "confianza_media"):
            geo[c] = np.nan

    print("4/6 Alertas")
    geo = altura(geo, cfg)
    geo = alertas.calcular(geo, cfg, hay_huellas)
    geo["ph"] = geo["condicion"] == "9"
    geo = geo.sort_values("puntaje", ascending=False).reset_index(drop=True)

    print("5/6 Exportación")
    props = [
        "npn", "direccion", "destino", "ph", "area_terreno", "area_construida_reg", "avaluo",
        "vigencia", "area_huella", "n_huellas", "confianza_media", "pisos_usados",
        "altura_ilustrativa", "altura", "A1", "A2", "A3", "puntaje", "nivel", "razones", "confianza",
    ]
    tol = None
    salida = cfg["salida"]
    web, api = Path(a.salida_web), Path(a.salida_api)
    while True:
        fc = a_geojson(geo, props, salida["decimales_coordenadas"], tol)
        mb = escribir(fc, [web / "sector02.geojson", api / "sector02.geojson"])
        if mb <= salida["tamano_maximo_mb"] or tol:
            break
        tol = salida["tolerancia_simplificar_m"]
        print(f"  {mb:.1f} MB > {salida['tamano_maximo_mb']} MB: simplificando a {tol} m")
    print(f"  sector02.geojson: {len(fc['features']):,} predios, {mb:.1f} MB")

    n_vol = 0
    if cortes is not None:
        sin_reg = set(geo.loc[geo["pisos_usados"] == 0, "llave21"])
        vol = cortes[cortes["llave21"].isin(sin_reg)].copy()
        vol["confianza"] = vol["confianza"].round(2)
        n_vol = len(vol)
        escribir(a_geojson(vol, ["llave21", "area_m2", "confianza"], salida["decimales_coordenadas"], None),
                 [web / "huellas_sector02.geojson", api / "huellas_sector02.geojson"])
    else:
        escribir({"type": "FeatureCollection", "features": []},
                 [web / "huellas_sector02.geojson", api / "huellas_sector02.geojson"])

    print("6/6 Resumen y manifiesto")
    resumen = {
        "sector": f"{zona}-{sector}",
        "predios_registro": int(len(sec)),
        "predios_con_geometria": int(len(geo)),
        "predios_sin_geometria": int(len(sin_geo)),
        "tasa_cruce": round(tasa, 4),
        "habitacionales_no_ph": int(len(hab)),
        "sin_area_construida": int((hab["area_construida_reg"] == 0).sum()),
        "alertas": {k: int(geo[k].sum()) for k in ("A1", "A2", "A3")},
        "predios_con_alerta": int((geo["puntaje"] > 0).sum()),
        "predios_rojos": int((geo["nivel"] == "rojo").sum()),
        "confianza_baja": int((geo["confianza"] == "baja").sum()),
        "huellas_sin_registro": n_vol,
        "evidencia_imagenes": bool(hay_huellas),
        "generado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    escribir(resumen, [web / "resumen.json", api / "resumen.json"])
    fuentes = {"registro1": a.registro, "terrenos": a.terrenos,
               "construcciones": a.construcciones, "open_buildings": a.huellas}
    manifiesto = {
        "generado": resumen["generado"],
        "fuentes": {
            k: ({"archivo": Path(v).name, "sha256": sha256(Path(v)), "bytes": Path(v).stat().st_size}
                if Path(v).exists() else {"archivo": Path(v).name, "disponible": False})
            for k, v in fuentes.items()
        },
        "licencias": {
            "open_buildings": "CC BY 4.0 u ODbL (Google Research)",
            "registro1_y_cartografia": "Datos abiertos, Alcaldía de Neiva (Gestión Catastral)",
        },
        "vigencia_registro1": str(sec["vigencia"].mode().iat[0]) if len(sec) else None,
    }
    escribir(manifiesto, [web / "manifiesto.json", api / "manifiesto.json"])
    print(json.dumps(resumen["alertas"], ensure_ascii=False), "| con alerta:", resumen["predios_con_alerta"])
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (ControlError, registro1.DatosPersonalesError, FileNotFoundError) as e:
        print(f"\nDETENIDO: {e}", file=sys.stderr)
        sys.exit(2)
