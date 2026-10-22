"""Kit de validación (Anexo 2, sección 7): muestra de predios y métricas.

    python -m pipeline.validacion muestra            # escribe docs/validacion/muestra.csv
    python -m pipeline.validacion metricas ARCHIVO   # calcula precisión, exhaustividad y F1

La muestra tiene dos grupos: los 50 predios de mayor puntaje ("prioridad") y 20 predios
sin alerta elegidos al azar ("control", semilla fija). Una persona revisa cada predio con
imagen satelital o visita y llena la columna `veredicto`: confirmado (hay diferencia entre
el registro y lo construido), descartado (no la hay) o no_concluyente.
"""
from __future__ import annotations

import csv
import json
import random
import sys
from pathlib import Path

from shapely.geometry import shape

RAIZ = Path(__file__).resolve().parent.parent
GEOJSON = RAIZ / "web" / "public" / "data" / "sector02.geojson"
SALIDA = RAIZ / "docs" / "validacion" / "muestra.csv"
N_PRIORIDAD, N_CONTROL, SEMILLA = 50, 20, 42
COLUMNAS = ["grupo", "npn", "direccion", "puntaje", "nivel", "alertas", "area_construida_reg",
            "area_huella", "confianza", "lat", "lon", "imagen", "veredicto", "observaciones"]
VEREDICTOS = {"confirmado", "descartado", "no_concluyente"}


def _fila(grupo: str, f: dict) -> dict:
    p = f["properties"]
    c = shape(f["geometry"]).centroid
    return {
        "grupo": grupo, "npn": p["npn"], "direccion": p["direccion"], "puntaje": p["puntaje"],
        "nivel": p["nivel"], "alertas": "+".join(k for k in ("A1", "A2", "A3") if p[k]),
        "area_construida_reg": p["area_construida_reg"],
        "area_huella": round(p["area_huella"] or 0), "confianza": p["confianza"],
        "lat": round(c.y, 6), "lon": round(c.x, 6),
        "imagen": f"https://www.google.com/maps/@{c.y:.6f},{c.x:.6f},19z/data=!3m1!1e3",
        "veredicto": "", "observaciones": "",
    }


def muestra() -> Path:
    fc = json.loads(GEOJSON.read_text(encoding="utf-8"))
    feats = fc["features"]
    con = sorted((f for f in feats if f["properties"]["puntaje"] > 0),
                 key=lambda f: (-f["properties"]["puntaje"], -(f["properties"]["area_huella"] or 0),
                                f["properties"]["npn"]))[:N_PRIORIDAD]
    sin = sorted((f for f in feats if f["properties"]["puntaje"] == 0 and not f["properties"]["ph"]),
                 key=lambda f: f["properties"]["npn"])
    ctl = random.Random(SEMILLA).sample(sin, N_CONTROL)
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    with open(SALIDA, "w", newline="", encoding="utf-8-sig") as out:
        w = csv.DictWriter(out, fieldnames=COLUMNAS)
        w.writeheader()
        w.writerows([_fila("prioridad", f) for f in con] + [_fila("control", f) for f in ctl])
    return SALIDA


def metricas(filas: list[dict]) -> dict:
    """Precisión, exhaustividad y F1 sobre la muestra (no extrapolables al sector)."""
    for f in filas:
        if f["veredicto"] not in VEREDICTOS:
            raise ValueError(f"Veredicto faltante o inválido en {f['npn']}: «{f['veredicto']}»")
    c = lambda g, v: sum(f["grupo"] == g and f["veredicto"] == v for f in filas)  # noqa: E731
    tp, fp, fn = c("prioridad", "confirmado"), c("prioridad", "descartado"), c("control", "confirmado")
    prec = tp / (tp + fp) if tp + fp else None
    rec = tp / (tp + fn) if tp + fn else None
    f1 = 2 * prec * rec / (prec + rec) if prec and rec else None
    return {
        "revisados": len(filas), "no_concluyentes": sum(f["veredicto"] == "no_concluyente" for f in filas),
        "verdaderos_positivos": tp, "falsos_positivos": fp, "falsos_negativos_control": fn,
        "precision": prec, "exhaustividad": rec, "f1": f1,
    }


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "muestra":
        print("Muestra escrita en", muestra())
    elif len(sys.argv) > 2 and sys.argv[1] == "metricas":
        with open(sys.argv[2], encoding="utf-8-sig") as fh:
            print(json.dumps(metricas(list(csv.DictReader(fh))), ensure_ascii=False, indent=2))
    else:
        print(__doc__)
        sys.exit(1)
