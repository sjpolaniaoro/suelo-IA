"""API mínima de Suelo-IA: lee los datos empaquetados en api/data/ (sin base de datos)."""
from __future__ import annotations

import json
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

DATOS = Path(__file__).parent / "data"


def _leer(nombre: str):
    ruta = DATOS / nombre
    if not ruta.exists():
        raise HTTPException(503, f"Dato no disponible: {nombre}. Corra el pipeline.")
    return json.loads(ruta.read_text(encoding="utf-8"))


def _predios() -> dict[str, dict]:
    return {f["properties"]["npn"]: f for f in _leer("sector02.geojson")["features"]}


app = FastAPI(title="Suelo-IA API", version="1.0")
# CORS abierto solo para el dominio de Vercel (variable de entorno ALLOWED_ORIGIN).
origen = os.environ.get("ALLOWED_ORIGIN", "http://localhost:5173")
app.add_middleware(CORSMiddleware, allow_origins=[origen], allow_methods=["GET"], allow_headers=["*"])

_cache: dict[str, dict] = {}


@app.get("/health")
def health():
    return {"estado": "ok"}


@app.get("/sectores/02/resumen")
def resumen():
    return {"resumen": _leer("resumen.json"), "manifiesto": _leer("manifiesto.json")}


@app.get("/predios/{npn}")
def predio(npn: str):
    if not _cache:
        _cache.update(_predios())
    f = _cache.get(npn)
    if f is None:
        raise HTTPException(404, "Predio no encontrado en el sector piloto.")
    return f


@app.get("/alertas")
def lista_alertas(
    tipo: str | None = Query(None, pattern="^(A[123]|NR)$"),
    accion: str | None = Query(None, pattern="^(oficina|campo)$"),
    limit: int = Query(50, ge=1, le=500),
):
    if not _cache:
        _cache.update(_predios())
    props = [f["properties"] for f in _cache.values()]
    if tipo == "NR":
        # Uso probablemente no residencial: sin puntaje de vivienda, se ordena por huella detectada.
        filas = [p for p in props if p.get("NR")]
        filas.sort(key=lambda p: p.get("area_huella") or 0, reverse=True)
    else:
        filas = [p for p in props if p["puntaje"] > 0 and (tipo is None or p[tipo])]
        filas.sort(key=lambda p: p["puntaje"], reverse=True)
    if accion:
        # Cola de trabajo de la triangulación: conciliar en oficina o verificar en campo.
        filas = [p for p in filas if p.get("accion") == accion]
    return {"total": len(filas), "predios": filas[:limit]}
