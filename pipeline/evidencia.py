"""Evidencia observada: asigna huellas de Open Buildings a terrenos por intersección."""
from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import pandas as pd
from shapely import wkt

from .cartografia import CRS_ORIGEN, CRS_WEB


def cargar_huellas(ruta: str | Path, confianza_min: float) -> gpd.GeoDataFrame:
    """Lee el CSV del notebook (geometry en WKT, area_in_meters, confidence)."""
    h = pd.read_csv(ruta)
    geom = h["geometry"].map(wkt.loads)
    g = gpd.GeoDataFrame(
        h[["confidence"]].rename(columns={"confidence": "confianza"}),
        geometry=geom,
        crs=CRS_WEB,
    ).to_crs(CRS_ORIGEN)
    return g[g["confianza"] >= confianza_min].reset_index(drop=True)


def asignar(huellas: gpd.GeoDataFrame, terrenos: gpd.GeoDataFrame):
    """Cada terreno recibe solo el área de huella que cae dentro de él.

    Devuelve (tabla por llave21, huellas recortadas al terreno).
    """
    t = terrenos[["llave21", "geometry"]]
    cortes = gpd.overlay(huellas, t, how="intersection", keep_geom_type=True)
    cortes["area_m2"] = cortes.geometry.area
    cortes["peso"] = cortes["area_m2"] * cortes["confianza"]
    por = cortes.groupby("llave21").agg(
        area_huella=("area_m2", "sum"),
        n_huellas=("area_m2", "size"),
        peso=("peso", "sum"),
    )
    por["confianza_media"] = por["peso"] / por["area_huella"]
    return por.drop(columns="peso").reset_index(), cortes
