"""Prueba de extremo a extremo con insumos sintéticos pequeños."""
import json

import numpy as np
import pandas as pd
import yaml

from pipeline import alertas, run
from tests import sintetico

with open(run.RAIZ / "pipeline" / "config.yaml", encoding="utf-8") as f:
    CFG = yaml.safe_load(f)


def _xlsx(ruta, sec):
    pd.DataFrame(
        {
            "NUMERO PREDIAL NACIONAL": sec["npn"],
            "DIRECCIÓN": "CL 1 1-1",
            "DESTINO ECONOMICO": sec["destino"],
            "AREA TERRENO": sec["area_terreno"].round().astype(int).astype(str).str.zfill(15),
            "AREA CONSTRUCCION": sec["area_construida_reg"].round().astype(int).astype(str).str.zfill(6),
            "AVALUO": sec["avaluo"].round().astype(int).astype(str).str.zfill(15),
            "VIGENCIA": "2025-01-01",
        }
    ).to_excel(ruta, index=False)


def test_extremo_a_extremo(tmp_path):
    sec = sintetico.crear(tmp_path / "s")
    _xlsx(tmp_path / "r1.xlsx", sec)
    web, api = tmp_path / "web", tmp_path / "api"
    codigo = run.main([
        "--sin-control",
        "--registro", str(tmp_path / "r1.xlsx"),
        "--terrenos", str(tmp_path / "s" / "Unidad_Espacial" / "Terrenos.shp"),
        "--construcciones", str(tmp_path / "s" / "Unidad_Espacial" / "Unidad de Construccion.shp"),
        "--huellas", str(tmp_path / "s" / "open_buildings_neiva.csv"),
        "--salida-web", str(web), "--salida-api", str(api),
    ])
    assert codigo == 0
    fc = json.loads((web / "sector02.geojson").read_text(encoding="utf-8"))
    assert len(fc["features"]) == len(sec)
    resumen = json.loads((api / "resumen.json").read_text(encoding="utf-8"))
    assert resumen["alertas"]["A1"] > 0
    tri = resumen["triangulacion"]
    assert tri["universo_sin_area"] == sum(
        tri[k] for k in ("dos_fuentes", "solo_cartografia", "solo_imagen", "sin_evidencia")
    )
    assert (web / "manifiesto.json").exists()
    # Sin datos personales en la salida.
    texto = (web / "sector02.geojson").read_text(encoding="utf-8").lower()
    assert "propietario" not in texto


def test_sin_huellas_solo_a3(tmp_path):
    sec = sintetico.crear(tmp_path / "s")
    _xlsx(tmp_path / "r1.xlsx", sec)
    run.main([
        "--sin-control", "--registro", str(tmp_path / "r1.xlsx"),
        "--terrenos", str(tmp_path / "s" / "Unidad_Espacial" / "Terrenos.shp"),
        "--construcciones", str(tmp_path / "s" / "Unidad_Espacial" / "Unidad de Construccion.shp"),
        "--huellas", str(tmp_path / "no_existe.csv"),
        "--salida-web", str(tmp_path / "w"), "--salida-api", str(tmp_path / "a"),
    ])
    r = json.loads((tmp_path / "w" / "resumen.json").read_text(encoding="utf-8"))
    assert r["alertas"]["A1"] == 0 and r["alertas"]["A2"] == 0
    assert r["evidencia_imagenes"] is False
    assert r["triangulacion"] is None


def _predios(**kw):
    base = dict(
        npn="x", condicion="0", destino="Habitacional", manzana_id="m", area_terreno=100.0,
        area_construida_reg=0.0, avaluo=1e8, terreno_m2=100.0, area_huella=0.0,
        confianza_media=np.nan,
    )
    base.update(kw)
    return pd.DataFrame([base])


def test_a1_requiere_umbral_de_huella():
    assert alertas.calcular(_predios(area_huella=84.0, confianza_media=0.9), CFG, True)["A1"].iat[0]
    assert not alertas.calcular(_predios(area_huella=10.0, confianza_media=0.9), CFG, True)["A1"].iat[0]


def test_huella_grande_es_uso_no_residencial_y_no_a1():
    umbral = CFG["alertas"]["A1"]["huella_no_residencial_min_m2"]
    r = alertas.calcular(_predios(area_huella=umbral + 1, confianza_media=0.9), CFG, True)
    assert r["NR"].iat[0] and not r["A1"].iat[0]
    assert r["puntaje"].iat[0] == 0 and r["nivel"].iat[0] == "no_residencial"
    assert "revisar destino" in r["razones"].iat[0][0]
    # Justo por debajo del umbral sigue siendo A1 de vivienda.
    r = alertas.calcular(_predios(area_huella=umbral - 1, confianza_media=0.9), CFG, True)
    assert r["A1"].iat[0] and not r["NR"].iat[0] and r["puntaje"].iat[0] >= 60


def test_nr_no_aplica_a_predios_con_area_construida_ni_ph():
    umbral = CFG["alertas"]["A1"]["huella_no_residencial_min_m2"]
    con_area = alertas.calcular(_predios(area_huella=umbral + 1, area_construida_reg=50.0), CFG, True)
    en_ph = alertas.calcular(_predios(area_huella=umbral + 1, condicion="9"), CFG, True)
    assert not con_area["NR"].iat[0] and not en_ph["NR"].iat[0]


def test_ph_no_recibe_a1_ni_a2():
    r = alertas.calcular(_predios(condicion="9", area_huella=90.0), CFG, True)
    assert not r["A1"].iat[0] and not r["A2"].iat[0]


def test_a2_area_subregistrada():
    r = alertas.calcular(_predios(area_construida_reg=40.0, area_huella=60.0), CFG, True)
    assert r["A2"].iat[0] and r["puntaje"].iat[0] >= 30


def test_confianza_baja_por_terreno_pequeno():
    r = alertas.calcular(_predios(terreno_m2=20.0), CFG, False)
    assert r["confianza"].iat[0] == "baja"
