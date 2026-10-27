"""Kit de validación (Anexo 2, sección 7): muestra de predios y métricas.

    python -m pipeline.validacion muestra            # escribe docs/validacion/muestra.csv
    python -m pipeline.validacion metricas ARCHIVO   # precisión, exhaustividad y F1 estimados

La muestra tiene tres grupos:
  - prioridad: los 50 predios de mayor puntaje (los casos más claros; sobrestiman la precisión).
  - aleatoria: muestra aleatoria estratificada de los demás predios con alerta (A1, A2 y A3).
  - control: predios sin alerta (sin propiedad horizontal) elegidos al azar, para estimar lo que
    el modelo no detecta.
Una persona revisa cada predio con imagen satelital o visita y llena `veredicto`: confirmado (hay
diferencia entre el registro y lo construido), descartado (no la hay) o no_concluyente. Dentro de
cada grupo la columna `orden` sigue un orden aleatorio, así que revisar los primeros N de cada
grupo también produce una muestra aleatoria válida (con menos precisión).

Las métricas ponderan cada estrato por su población, que se guarda en poblacion.json junto a la muestra.
"""
from __future__ import annotations

import csv
import json
import math
import random
import sys
from pathlib import Path

from shapely.geometry import shape

RAIZ = Path(__file__).resolve().parent.parent
GEOJSON = RAIZ / "web" / "public" / "data" / "sector02.geojson"
CARPETA = RAIZ / "docs" / "validacion"
SALIDA = CARPETA / "muestra.csv"
POBLACION = CARPETA / "poblacion.json"
N_PRIORIDAD, SEMILLA = 50, 42
N_ALEATORIA = {"A1": 60, "A2": 40, "A3": 30}
N_CONTROL = 60
COLUMNAS = ["grupo", "estrato", "orden", "npn", "direccion", "puntaje", "nivel", "alertas",
            "area_construida_reg", "area_huella", "confianza", "lat", "lon", "imagen",
            "veredicto", "observaciones"]
VEREDICTOS = {"confirmado", "descartado", "no_concluyente"}
Z = 1.96


def estrato(p: dict) -> str:
    """Cada predio con alerta cae en un solo estrato: A1, luego A2, luego A3."""
    return "A1" if p["A1"] else "A2" if p["A2"] else "A3"


def _fila(grupo: str, est: str, orden: int, f: dict) -> dict:
    p = f["properties"]
    c = shape(f["geometry"]).centroid
    return {
        "grupo": grupo, "estrato": est, "orden": orden, "npn": p["npn"], "direccion": p["direccion"],
        "puntaje": p["puntaje"], "nivel": p["nivel"],
        "alertas": "+".join(k for k in ("A1", "A2", "A3") if p[k]),
        "area_construida_reg": p["area_construida_reg"], "area_huella": round(p["area_huella"] or 0),
        "confianza": p["confianza"], "lat": round(c.y, 6), "lon": round(c.x, 6),
        "imagen": f"https://www.google.com/maps/@{c.y:.6f},{c.x:.6f},19z/data=!3m1!1e3",
        "veredicto": "", "observaciones": "",
    }


def muestra() -> Path:
    fc = json.loads(GEOJSON.read_text(encoding="utf-8"))
    feats = [f for f in fc["features"] if f["geometry"]]
    alertas = [f for f in feats if f["properties"]["puntaje"] > 0]
    def clave(f):
        p = f["properties"]
        return (-p["puntaje"], -(p["area_huella"] or 0), p["npn"])

    top = sorted(alertas, key=clave)[:N_PRIORIDAD]
    en_top = {f["properties"]["npn"] for f in top}
    rng = random.Random(SEMILLA)

    filas = [_fila("prioridad", estrato(f["properties"]), i + 1, f) for i, f in enumerate(top)]
    poblacion = {"alertas": {}, "control": 0, "prioridad_top": N_PRIORIDAD}
    for est, n in N_ALEATORIA.items():
        total = [f for f in alertas if estrato(f["properties"]) == est]
        poblacion["alertas"][est] = len(total)
        resto = sorted((f for f in total if f["properties"]["npn"] not in en_top),
                       key=lambda f: f["properties"]["npn"])
        elegidos = rng.sample(resto, min(n, len(resto)))
        filas += [_fila("aleatoria", est, i + 1, f) for i, f in enumerate(elegidos)]
    # Los NR (uso probablemente no residencial) no son vivienda sin alerta: quedan fuera del control.
    poblacion["no_residencial"] = sum(bool(f["properties"].get("NR")) for f in feats)
    sin = sorted((f for f in feats if f["properties"]["puntaje"] == 0 and not f["properties"]["ph"]
                  and not f["properties"].get("NR")),
                 key=lambda f: f["properties"]["npn"])
    poblacion["control"] = len(sin)
    ctl = rng.sample(sin, min(N_CONTROL, len(sin)))
    filas += [_fila("control", "sin_alerta", i + 1, f) for i, f in enumerate(ctl)]

    CARPETA.mkdir(parents=True, exist_ok=True)
    with open(SALIDA, "w", newline="", encoding="utf-8-sig") as out:
        w = csv.DictWriter(out, fieldnames=COLUMNAS)
        w.writeheader()
        w.writerows(filas)
    POBLACION.write_text(json.dumps(poblacion, ensure_ascii=False, indent=2), encoding="utf-8")
    return SALIDA


def wilson(k: int, n: int) -> tuple[float, float] | None:
    """Intervalo de Wilson al 95 % para una proporción k/n."""
    if n == 0:
        return None
    p = k / n
    d = 1 + Z * Z / n
    centro = (p + Z * Z / (2 * n)) / d
    medio = Z * math.sqrt(p * (1 - p) / n + Z * Z / (4 * n * n)) / d
    return max(0.0, centro - medio), min(1.0, centro + medio)


def metricas(filas: list[dict], poblacion: dict) -> dict:
    """Precisión, exhaustividad y F1 estimados con la muestra y ponderados por población.

    Los veredictos `no_concluyente` se excluyen de las tasas y se informan aparte; las filas
    sin veredicto se ignoran (se cuentan como pendientes), así que se puede medir con revisión parcial.
    """
    pendientes = sum(not f["veredicto"] for f in filas)
    filas = [f for f in filas if f["veredicto"]]
    for f in filas:
        if f["veredicto"] not in VEREDICTOS:
            raise ValueError(f"Veredicto inválido en {f['npn']}: «{f['veredicto']}»")

    def cuenta(grupo, est=None):
        sel = [f for f in filas if f["grupo"] == grupo and (est is None or f["estrato"] == est)]
        conf = sum(f["veredicto"] == "confirmado" for f in sel)
        return conf, sum(f["veredicto"] == "descartado" for f in sel)

    out = {
        "revisados": len(filas), "pendientes": pendientes,
        "no_concluyentes": sum(f["veredicto"] == "no_concluyente" for f in filas),
    }
    # Precisión de los casos más claros (sesgada al alza).
    k, d = cuenta("prioridad")
    out["precision_top"] = {"k": k, "n": k + d, "tasa": k / (k + d) if k + d else None}

    # Precisión estimada de todas las alertas: estratos ponderados por su población.
    pesos, tasas, var = {}, {}, 0.0
    for est, N in poblacion["alertas"].items():
        k, d = cuenta("aleatoria", est)
        if k + d:
            pesos[est], tasas[est] = N, k / (k + d)
            var += (N ** 2) * tasas[est] * (1 - tasas[est]) / (k + d)
    total = sum(pesos.values())
    prec = sum(pesos[e] * tasas[e] for e in pesos) / total if total else None
    out["precision_por_estrato"] = {e: {"tasa": tasas[e], "n": sum(cuenta("aleatoria", e))} for e in tasas}
    out["precision_estimada"] = prec
    if prec is not None:
        e = Z * math.sqrt(var) / total
        out["precision_ic95"] = (max(0.0, prec - e), min(1.0, prec + e))
    else:
        out["precision_ic95"] = None

    # Omisión: confirmados entre los predios sin alerta, escalada a la población sin alerta.
    k, d = cuenta("control")
    out["control"] = {"confirmados": k, "revisados": k + d, "ic95": wilson(k, k + d)}
    if prec is not None and k + d:
        tp = prec * total
        fn = (k / (k + d)) * poblacion["control"]
        rec = tp / (tp + fn) if tp + fn else None
        out.update({"verdaderos_positivos_estimados": round(tp), "falsos_negativos_estimados": round(fn),
                    "exhaustividad_estimada": rec,
                    "f1_estimado": 2 * prec * rec / (prec + rec) if rec else None,
                    })
    return out


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "muestra":
        print("Muestra escrita en", muestra())
    elif len(sys.argv) > 2 and sys.argv[1] == "metricas":
        with open(sys.argv[2], encoding="utf-8-sig") as fh:
            filas = list(csv.DictReader(fh))
        pob = json.loads(POBLACION.read_text(encoding="utf-8"))
        print(json.dumps(metricas(filas, pob), ensure_ascii=False, indent=2))
    else:
        print(__doc__)
        sys.exit(1)
