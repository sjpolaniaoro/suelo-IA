"""Cartografía predial: terrenos y construcciones (EPSG:9377 -> 4326 solo al exportar)."""
from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import pandas as pd

CRS_ORIGEN = "EPSG:9377"
CRS_WEB = "EPSG:4326"


def _minusculas(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    gdf.columns = [c if c == "geometry" else c.lower() for c in gdf.columns]
    return gdf


def cargar_terrenos(ruta: str | Path, zona: str, sector: str) -> gpd.GeoDataFrame:
    """Terrenos del sector, en metros (EPSG:9377), con la llave de 21 dígitos."""
    t = _minusculas(gpd.read_file(ruta))
    if t.crs is None:
        t = t.set_crs(CRS_ORIGEN)
    elif t.crs.to_string() != CRS_ORIGEN:
        t = t.to_crs(CRS_ORIGEN)
    t["name"] = t["name"].astype(str)
    t = t[(t["name"].str[5:7] == zona) & (t["name"].str[7:9] == sector)].copy()
    t["llave21"] = t["name"].str[:21]
    t["duplicado"] = t.duplicated("llave21", keep="first")
    t.attrs["terrenos_sector"] = len(t)
    t.attrs["llaves_duplicadas"] = int(t["duplicado"].sum())
    return t[~t["duplicado"]].drop(columns="duplicado").reset_index(drop=True)


def pisos_por_terreno(ruta: str | Path, llaves: set[str]) -> pd.DataFrame:
    """Pisos, número y área dibujada de construcciones por terreno (cartografía oficial)."""
    c = _minusculas(gpd.read_file(ruta, ignore_geometry=True))
    c["llave21"] = c["name"].astype(str).str[:21]
    c = c[c["llave21"].isin(llaves)].copy()
    c["numero_pis"] = pd.to_numeric(c["numero_pis"], errors="coerce")
    # Área de huella de lo dibujado (suma de `area_const`); sirve de evidencia para la triangulación.
    c["area_cart"] = (
        pd.to_numeric(c["area_const"], errors="coerce").fillna(0.0) if "area_const" in c.columns else 0.0
    )
    agg = c.groupby("llave21").agg(
        pisos=("numero_pis", "max"), n_construcciones=("llave21", "size"), area_cart=("area_cart", "sum")
    )
    return agg.reset_index()


def cruzar(predios: pd.DataFrame, terrenos: gpd.GeoDataFrame, pisos: pd.DataFrame):
    """Une predios del Registro 1 con su terreno por la llave de 21 dígitos.

    Devuelve (predios con geometría, predios sin geometría, tasa de cruce).
    """
    cols = ["llave21", "geometry"]
    t = terrenos[cols].merge(pisos, on="llave21", how="left")
    unido = predios.merge(t, on="llave21", how="left")
    con = unido["geometry"].notna()
    tasa = float(con.mean()) if len(unido) else 0.0
    geo = gpd.GeoDataFrame(unido[con].copy(), geometry="geometry", crs=CRS_ORIGEN)
    sin = unido[~con].drop(columns="geometry")
    return geo, sin, tasa
