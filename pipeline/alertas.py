"""Alertas A1, A2 y A3, puntaje de prioridad, razones y confianza (spec, sección 3)."""
from __future__ import annotations

import numpy as np
import pandas as pd


def _fmt(x: float) -> str:
    return f"{x:,.0f}".replace(",", ".")


def residuo_avaluo(df: pd.DataFrame, min_predios: int) -> pd.Series:
    """Residuo de log(avalúo) ~ log(terreno) + log(construida), efecto fijo de manzana."""
    ok = (
        (df["condicion"] == "0")
        & (df["avaluo"] > 0)
        & (df["area_terreno"] > 0)
        & (df["area_construida_reg"] > 0)
    )
    m = df[ok].copy()
    m = m[m.groupby("manzana_id")["npn"].transform("size") >= min_predios]
    res = pd.Series(np.nan, index=df.index)
    if len(m) < 3:
        return res
    y = np.log(m["avaluo"].to_numpy())
    x = np.column_stack([np.log(m["area_terreno"]), np.log(m["area_construida_reg"])])
    g = m["manzana_id"].to_numpy()
    media_y = pd.Series(y).groupby(g).transform("mean").to_numpy()
    media_x = np.column_stack(
        [pd.Series(x[:, j]).groupby(g).transform("mean").to_numpy() for j in range(2)]
    )
    yd, xd = y - media_y, x - media_x
    beta, *_ = np.linalg.lstsq(xd, yd, rcond=None)
    res.loc[m.index] = yd - xd @ beta
    return res


def calcular(df: pd.DataFrame, cfg: dict, hay_huellas: bool) -> pd.DataFrame:
    """Agrega columnas de alertas, puntaje, nivel, razones y confianza."""
    a = cfg["alertas"]
    out = df.copy()
    nph = out["condicion"] == "0"
    huella = out["area_huella"].fillna(0.0) if hay_huellas else pd.Series(0.0, index=out.index)

    sin_registro = (
        hay_huellas
        & (out["destino"] == "Habitacional")
        & nph
        & (out["area_construida_reg"] == 0)
        & (huella >= a["A1"]["area_huella_min_m2"])
    )
    # Huella muy grande bajo destino Habitacional: probable uso no residencial con destino desactualizado.
    out["NR"] = sin_registro & (huella >= a["A1"]["huella_no_residencial_min_m2"])
    out["A1"] = sin_registro & ~out["NR"]
    out["A2"] = (
        hay_huellas
        & nph
        & (out["area_construida_reg"] > 0)
        & (huella > a["A2"]["factor_area"] * out["area_construida_reg"])
    )
    out["residuo_a3"] = residuo_avaluo(out, a["A3"]["min_predios_manzana"])
    out["A3"] = out["residuo_a3"].abs() > a["A3"]["umbral_log"]

    aj = a["ajuste_huella"]
    ajuste = (huella.clip(upper=aj["area_tope_m2"]) / aj["area_tope_m2"]) * aj["max_puntos"]
    base = (
        out["A1"] * a["A1"]["puntos"]
        + out["A2"] * a["A2"]["puntos"]
        + out["A3"] * a["A3"]["puntos"]
    )
    out["puntaje"] = (base + ajuste.where(out["A1"] | out["A2"], 0.0)).clip(upper=100).round(0)
    # NR queda fuera del puntaje de vivienda: es una pregunta sobre el destino, no sobre construcción oculta.
    out.loc[out["NR"], "puntaje"] = 0.0
    out["nivel"] = np.select(
        [
            out["NR"],
            out["puntaje"] >= a["A1"]["puntos"],
            out["puntaje"] >= a["A2"]["puntos"],
            out["puntaje"] > 0,
        ],
        ["no_residencial", "rojo", "naranja", "amarillo"],
        default="sin_alerta",
    )

    c = cfg["confianza"]
    baja = (out["terreno_m2"] < c["terreno_min_m2"]) | (
        out["confianza_media"].notna() & (out["confianza_media"] < c["huella_media_min"])
    )
    out["confianza"] = np.where(baja, "baja", "normal")
    out["razones"] = [_razones(r) for r in out.itertuples()]
    return out


def _razones(r) -> list[str]:
    razones = []
    if r.A1:
        razones.append(
            f"Huella detectada de {_fmt(r.area_huella)} m², sin área construida registrada."
        )
    if r.NR:
        razones.append(
            "Uso probablemente no residencial: revisar destino. "
            f"Huella detectada de {_fmt(r.area_huella)} m² en un predio registrado como "
            "Habitacional sin área construida."
        )
    if r.A2:
        razones.append(
            f"Huella detectada de {_fmt(r.area_huella)} m² frente a "
            f"{_fmt(r.area_construida_reg)} m² construidos registrados."
        )
    if r.A3:
        sentido = (
            "más del doble de lo esperado" if r.residuo_a3 > 0 else "menos de la mitad de lo esperado"
        )
        razones.append(f"Avalúo de {sentido} frente a predios similares de la manzana.")
    if r.condicion == "9":
        razones.append("Propiedad horizontal: el área se registra por unidad.")
    return razones
