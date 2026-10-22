"""Genera insumos SINTÉTICOS (geometría inventada) para probar el pipeline y la web.

Nunca se publican como datos del piloto. Uso:
    python -m tests.sintetico data/sintetico [ruta_registro1.xlsx]
"""
from __future__ import annotations

import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import yaml
from shapely.geometry import box

from pipeline import registro1

# Neiva (EPSG:9377, metros). Origen arbitrario dentro del casco urbano.
X0, Y0 = 4_800_000.0, 1_950_000.0


def crear(destino: Path, registro_xlsx: str | None = None, semilla: int = 7):
    rng = np.random.default_rng(semilla)
    destino.mkdir(parents=True, exist_ok=True)
    cfg = yaml.safe_load(open(Path(__file__).parent.parent / "pipeline" / "config.yaml", encoding="utf-8"))
    if registro_xlsx:
        r1 = registro1.cargar(registro_xlsx, cfg["prohibidas"])
        sec = registro1.recortar_sector(r1, "01", "02")
    else:
        sec = _registro_minimo(rng)
    llaves = sorted(sec["llave21"].unique())
    lado = int(np.ceil(np.sqrt(len(llaves))))
    filas, cons, huellas = [], [], []
    for i, ll in enumerate(llaves):
        gx, gy = i % lado, i // lado
        w, h = rng.uniform(10, 18), rng.uniform(10, 18)
        x, y = X0 + gx * 22, Y0 + gy * 22
        filas.append({"name": ll + "000000000", "area_terre": w * h, "geometry": box(x, y, x + w, y + h)})
        grupo = sec[sec["llave21"] == ll]
        registrada = (grupo["area_construida_reg"].fillna(0) > 0).any()
        if registrada:
            cons.append({"name": ll + "000000000", "area_const": 50.0,
                         "numero_pis": int(rng.integers(1, 4)), "geometry": box(x + 1, y + 1, x + 6, y + 6)})
        elif rng.random() < 0.4:
            huellas.append((box(x + 2, y + 2, x + 2 + rng.uniform(4, 9), y + 2 + rng.uniform(4, 9)),
                            float(rng.uniform(0.65, 0.95))))
    gdf = gpd.GeoDataFrame(filas, crs="EPSG:9377")
    carpeta = destino / "Unidad_Espacial"
    carpeta.mkdir(exist_ok=True)
    gdf.to_file(carpeta / "Terrenos.shp")
    gpd.GeoDataFrame(cons, crs="EPSG:9377").to_file(carpeta / "Unidad de Construccion.shp")
    hg = gpd.GeoDataFrame(
        {"confidence": [c for _, c in huellas]}, geometry=[g for g, _ in huellas], crs="EPSG:9377"
    ).to_crs("EPSG:4326")
    pd.DataFrame({"confidence": hg["confidence"], "geometry": hg.geometry.to_wkt()}).to_csv(
        destino / "open_buildings_neiva.csv", index=False
    )
    return sec


def _registro_minimo(rng) -> pd.DataFrame:
    filas = []
    for m in range(12):
        for t in range(1, 15):
            ll = "41001" + "01" + "02" + "01" + "01" + f"{m + 1:04d}" + f"{t:04d}"
            filas.append(
                {"npn": ll + "0" + "00" + "00" + "0000", "llave21": ll, "destino": "Habitacional",
                 "condicion": "0", "manzana_id": ll[:17],
                 "area_terreno": float(rng.uniform(80, 250)),
                 "area_construida_reg": float(0 if rng.random() < 0.3 else rng.uniform(40, 200)),
                 "avaluo": float(rng.uniform(5e7, 3e8))}
            )
    return pd.DataFrame(filas)


if __name__ == "__main__":
    crear(Path(sys.argv[1]), sys.argv[2] if len(sys.argv) > 2 else None)
    print("Insumos sintéticos escritos en", sys.argv[1])
