"""Triangulación registro-cartografía-imagen para las alertas A1 y A2.

Cada alerta de área construida se contrasta con dos evidencias independientes del registro:
la cartografía oficial de construcciones y las huellas de imagen (Open Buildings). Según cuántas
fuentes contradicen el registro, el caso se resuelve en oficina o pide visita:

- dos_fuentes:       cartografía e imagen contradicen el registro -> conciliar en oficina.
- solo_cartografia:  solo la cartografía contradice el registro    -> conciliar en oficina.
- solo_imagen:       solo la imagen contradice el registro         -> verificar en campo.
- sin_evidencia:     ninguna fuente contradice el registro         -> sin acción (p. ej. lote vacío).

Los umbrales viven en pipeline/config.yaml (sección consistencia), no aquí.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

TRIANGULACION = ("dos_fuentes", "solo_cartografia", "solo_imagen", "sin_evidencia")
ACCION = {
    "dos_fuentes": "oficina",
    "solo_cartografia": "oficina",
    "solo_imagen": "campo",
    "sin_evidencia": None,
}
RAZON = {
    ("A1", "dos_fuentes"): (
        "La cartografía oficial también dibuja construcción ({cart} m²): el registro parece "
        "desactualizado; se concilia en oficina."
    ),
    ("A1", "solo_imagen"): (
        "La cartografía oficial no dibuja construcción: solo la imagen la detecta; "
        "conviene verificar en campo."
    ),
    ("A2", "dos_fuentes"): (
        "La cartografía oficial dibuja {cart} m² de construcciones: coincide con la imagen y el "
        "registro parece subregistrado; se concilia en oficina."
    ),
    ("A2", "solo_imagen"): (
        "La cartografía oficial no respalda la diferencia: solo la imagen la detecta; "
        "conviene verificar en campo."
    ),
}


def _fmt(x: float) -> str:
    return f"{x:,.0f}".replace(",", ".")


def clasificar(cart: pd.Series, img: pd.Series) -> pd.Series:
    """Categoría de triangulación a partir de las dos evidencias (booleanas)."""
    return pd.Series(
        np.select(
            [cart & img, cart & ~img, ~cart & img],
            ["dos_fuentes", "solo_cartografia", "solo_imagen"],
            default="sin_evidencia",
        ),
        index=cart.index,
    )


def triangular(df: pd.DataFrame, cfg: dict, hay_huellas: bool) -> pd.DataFrame:
    """Agrega ev_cartografia, ev_imagen, triangulacion y accion; completa las razones de A1 y A2.

    Universo: predios habitacionales sin propiedad horizontal con área construida registrada = 0
    (para A1) y predios con A2. Sin huellas de imagen no hay triangulación: queda sin clasificar.
    """
    c = cfg["consistencia"]
    a1 = cfg["alertas"]["A1"]
    out = df.copy()
    out["triangulacion"] = None
    out["accion"] = None
    area_cart = out["area_cart"].fillna(0.0) if "area_cart" in out else pd.Series(0.0, index=out.index)
    out["area_cart"] = area_cart
    nph = out["condicion"] == "0"
    reg = out["area_construida_reg"].fillna(0.0)
    huella = out["area_huella"].fillna(0.0) if hay_huellas else pd.Series(0.0, index=out.index)

    # Evidencia de cartografía: depende de qué se contradice (sin área registrada o área subregistrada).
    cero = (out["destino"] == "Habitacional") & nph & (reg == 0)
    ev_cart_cero = area_cart >= c["cartografia_min_m2"]
    ev_cart_subreg = area_cart > cfg["alertas"]["A2"]["factor_area"] * reg
    out["ev_cartografia"] = np.where(
        cero, ev_cart_cero, np.where(nph & (reg > 0), ev_cart_subreg, False)
    ).astype(bool)
    out["ev_imagen"] = (huella >= a1["area_huella_min_m2"]) & cero | (out["A2"].astype(bool))

    if not hay_huellas:
        return out

    universo = cero | out["A2"].astype(bool)
    tri = clasificar(out["ev_cartografia"], out["ev_imagen"])
    out.loc[universo, "triangulacion"] = tri[universo]
    out["accion"] = pd.Series(
        [ACCION[t] if u else None for t, u in zip(tri, universo)], index=out.index, dtype=object
    )
    # Un NR pide revisar el destino: es trabajo de oficina aunque la imagen sea la única fuente.
    out.loc[out["NR"].astype(bool), "accion"] = "oficina"

    # Razones: una frase más para las alertas A1 y A2 según la triangulación.
    nuevas = []
    for r in out.itertuples():
        razones = list(r.razones)
        for alerta in ("A1", "A2"):
            if getattr(r, alerta):
                txt = RAZON.get((alerta, r.triangulacion))
                if txt:
                    razones.append(txt.format(cart=_fmt(r.area_cart)))
        nuevas.append(razones)
    out["razones"] = nuevas
    return out


def resumen(df: pd.DataFrame) -> dict:
    """Conteos de la triangulación y de las colas de trabajo, para resumen.json."""
    sin_area = df["area_construida_reg"].fillna(0) == 0
    cero = (df["destino"] == "Habitacional") & (df["condicion"] == "0") & sin_area
    universo = df[cero]
    cuentas = universo["triangulacion"].value_counts()
    # Las colas cuentan alertas de vivienda (A1 y A2); NR va aparte, con su propia revisión de destino.
    alerta = df[df["A1"].astype(bool) | df["A2"].astype(bool)]
    return {
        "universo_sin_area": int(len(universo)),
        **{k: int(cuentas.get(k, 0)) for k in TRIANGULACION},
        "a1_dos_fuentes": int((df["A1"].astype(bool) & (df["triangulacion"] == "dos_fuentes")).sum()),
        "a1_solo_imagen": int((df["A1"].astype(bool) & (df["triangulacion"] == "solo_imagen")).sum()),
        "a2_dos_fuentes": int((df["A2"].astype(bool) & (df["triangulacion"] == "dos_fuentes")).sum()),
        "a2_solo_imagen": int((df["A2"].astype(bool) & (df["triangulacion"] == "solo_imagen")).sum()),
        "cola_oficina": int((alerta["accion"] == "oficina").sum()),
        "cola_campo": int((alerta["accion"] == "campo").sum()),
    }
