"""Carga y normaliza el Registro 1 catastral de Neiva (datos abiertos)."""
from __future__ import annotations

import unicodedata
from pathlib import Path

import pandas as pd


class DatosPersonalesError(RuntimeError):
    """El insumo trae columnas con datos personales."""


def _plano(texto: str) -> str:
    """Minúsculas y sin tildes, tolerando caracteres rotos por codificación."""
    base = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode()
    return base.lower()


def validar_sin_datos_personales(columnas, prohibidas) -> None:
    """Falla con error explícito si aparece una columna de datos personales."""
    palabras = [_plano(p) for p in prohibidas]
    halladas = [c for c in columnas if any(p in _plano(c) for p in palabras)]
    if halladas:
        raise DatosPersonalesError(
            f"El insumo trae columnas con datos personales: {halladas}. "
            "El pipeline no las lee ni las escribe; retírelas del archivo."
        )


def _numero(serie: pd.Series) -> pd.Series:
    return pd.to_numeric(serie, errors="coerce")


def descomponer_npn(npn: pd.Series) -> pd.DataFrame:
    """Descompone el número predial nacional de 30 dígitos (spec, sección 3)."""
    return pd.DataFrame(
        {
            "departamento": npn.str[0:2],
            "municipio": npn.str[2:5],
            "zona": npn.str[5:7],
            "sector": npn.str[7:9],
            "comuna": npn.str[9:11],
            "barrio": npn.str[11:13],
            "manzana": npn.str[13:17],
            "terreno": npn.str[17:21],
            "condicion": npn.str[21],
            "edificio": npn.str[22:24],
            "piso": npn.str[24:26],
            "unidad": npn.str[26:30],
            "llave21": npn.str[0:21],
            "manzana_id": npn.str[0:17],
        },
        index=npn.index,
    )


def cargar(ruta: str | Path, prohibidas) -> pd.DataFrame:
    """Lee el xlsx como texto, valida PII, deduplica por predio y tipifica."""
    crudo = pd.read_excel(ruta, dtype=str)
    validar_sin_datos_personales(crudo.columns, prohibidas)

    col_dir = next(c for c in crudo.columns if _plano(c).startswith("direcc"))
    df = crudo.rename(
        columns={
            "NUMERO PREDIAL NACIONAL": "npn",
            col_dir: "direccion",
            "DESTINO ECONOMICO": "destino",
            "AREA TERRENO": "area_terreno",
            "AREA CONSTRUCCION": "area_construida",
            "AVALUO": "avaluo",
            "VIGENCIA": "vigencia",
        }
    )
    filas_crudas = len(df)
    df = df.drop_duplicates(subset="npn", keep="first").copy()

    # Vacíos o ceros son dato faltante, no cero (spec, sección 5).
    df["area_terreno"] = _numero(df["area_terreno"])
    df["area_construida_reg"] = _numero(df["area_construida"])
    df["avaluo"] = _numero(df["avaluo"])
    df["direccion"] = df["direccion"].fillna("").str.strip()

    df = pd.concat([df, descomponer_npn(df["npn"])], axis=1)
    df.attrs["filas_crudas"] = filas_crudas
    df.attrs["predios_unicos"] = len(df)
    return df[
        [
            "npn", "direccion", "destino", "area_terreno", "area_construida_reg",
            "avaluo", "vigencia", "zona", "sector", "manzana", "manzana_id",
            "terreno", "condicion", "llave21",
        ]
    ]


def recortar_sector(df: pd.DataFrame, zona: str, sector: str) -> pd.DataFrame:
    return df[(df["zona"] == zona) & (df["sector"] == sector)].copy()


def habitacionales_no_ph(df: pd.DataFrame) -> pd.DataFrame:
    """Habitacional y condición de propiedad 0 (no PH)."""
    return df[(df["destino"] == "Habitacional") & (df["condicion"] == "0")]
