"""Conexión a las fuentes abiertas. Cada descarga es explícita (subcomando).

    python -m pipeline.fuentes unidad-espacial   # Terrenos y Construccion (Drive abierto)
    python -m pipeline.fuentes open-buildings    # huellas de Open Buildings v3 para Neiva

Si la descarga falla (cuota de Drive, red), copie los archivos a data/raw/ a mano;
el pipeline funciona igual con los archivos locales.
"""
from __future__ import annotations

import csv
import gzip
import io
import sys
from pathlib import Path

import requests

RAIZ = Path(__file__).resolve().parent.parent
RAW = RAIZ / "data" / "raw"

# Carpeta pública de datos abiertos de la Dirección de Gestión Catastral (Anexo 2, sección 2).
DRIVE_CARPETA = "1rDuzwkfyFtRMeWYA2_xqqPWMjvKDs67g"
CAPAS = ("Terrenos", "Construccion")

TILES = "https://openbuildings-public-dot-gweb-research.uw.r.appspot.com/public/tiles.geojson"
# Rectángulo de Neiva (spec, tarea 2).
LON_MIN, LON_MAX, LAT_MIN, LAT_MAX = -75.34, -75.22, 2.86, 3.01


def unidad_espacial() -> None:
    import gdown

    destino = RAW / "Unidad_Espacial"
    destino.mkdir(parents=True, exist_ok=True)
    archivos = gdown.download_folder(id=DRIVE_CARPETA, skip_download=True, quiet=True) or []
    for f in archivos:
        base = Path(f.path.replace("\\", "/")).name
        if not base.startswith(CAPAS):
            continue
        gdown.download(id=f.id, output=str(destino / base), quiet=True)
        print("descargado:", base)


def _tile_neiva() -> dict:
    idx = requests.get(TILES, timeout=60).json()
    lon, lat = (LON_MIN + LON_MAX) / 2, (LAT_MIN + LAT_MAX) / 2
    for f in idx["features"]:
        xs = [p[0] for p in f["geometry"]["coordinates"][0]]
        ys = [p[1] for p in f["geometry"]["coordinates"][0]]
        if min(xs) <= lon <= max(xs) and min(ys) <= lat <= max(ys):
            return f["properties"]
    raise RuntimeError("No se encontró la celda de Open Buildings que cubre Neiva.")


def open_buildings() -> None:
    """Descarga por streaming la celda S2 de Neiva y conserva solo el rectángulo de Neiva."""
    prop = _tile_neiva()
    print(f"celda: {prop['tile_url']} ({prop.get('size_mb', '?')} MB)")
    RAW.mkdir(parents=True, exist_ok=True)
    salida = RAW / "open_buildings_neiva.csv"
    n = 0
    with requests.get(prop["tile_url"], stream=True, timeout=120) as r, open(
        salida, "w", newline="", encoding="utf-8"
    ) as out:
        r.raise_for_status()
        lector = csv.DictReader(io.TextIOWrapper(gzip.GzipFile(fileobj=r.raw), encoding="utf-8"))
        w = csv.writer(out)
        w.writerow(["confidence", "area_in_meters", "geometry"])
        for fila in lector:
            lat, lon = float(fila["latitude"]), float(fila["longitude"])
            if LON_MIN <= lon <= LON_MAX and LAT_MIN <= lat <= LAT_MAX:
                w.writerow([fila["confidence"], fila["area_in_meters"], fila["geometry"]])
                n += 1
    print(f"{n:,} huellas guardadas en {salida}")


if __name__ == "__main__":
    accion = sys.argv[1] if len(sys.argv) > 1 else ""
    if accion == "unidad-espacial":
        unidad_espacial()
    elif accion == "open-buildings":
        open_buildings()
    else:
        print(__doc__)
        sys.exit(1)
