"""Triangulación registro-cartografía-imagen (pipeline/consistencia.py)."""
import numpy as np
import pandas as pd
import yaml

from pipeline import alertas, consistencia, run

with open(run.RAIZ / "pipeline" / "config.yaml", encoding="utf-8") as f:
    CFG = yaml.safe_load(f)
MIN_CART = CFG["consistencia"]["cartografia_min_m2"]


def _caso(hay_huellas=True, **kw):
    base = dict(
        npn="x", condicion="0", destino="Habitacional", manzana_id="m", area_terreno=300.0,
        area_construida_reg=0.0, avaluo=1e8, terreno_m2=300.0, area_huella=0.0,
        confianza_media=0.9, area_cart=0.0,
    )
    base.update(kw)
    df = alertas.calcular(pd.DataFrame([base]), CFG, hay_huellas)
    return consistencia.triangular(df, CFG, hay_huellas)


def test_a1_con_cartografia_e_imagen_es_trabajo_de_oficina():
    r = _caso(area_huella=80.0, area_cart=60.0)
    assert r["A1"].iat[0]
    assert r["triangulacion"].iat[0] == "dos_fuentes" and r["accion"].iat[0] == "oficina"
    assert any("cartografía oficial también dibuja" in t for t in r["razones"].iat[0])


def test_a1_solo_con_imagen_pide_campo():
    r = _caso(area_huella=80.0, area_cart=0.0)
    assert r["triangulacion"].iat[0] == "solo_imagen" and r["accion"].iat[0] == "campo"
    assert any("solo la imagen" in t for t in r["razones"].iat[0])


def test_cartografia_sin_imagen_se_clasifica_pero_no_es_alerta():
    r = _caso(area_huella=0.0, area_cart=60.0)
    assert not r["A1"].iat[0] and r["puntaje"].iat[0] == 0
    assert r["triangulacion"].iat[0] == "solo_cartografia" and r["accion"].iat[0] == "oficina"


def test_sin_ninguna_evidencia_no_genera_accion():
    r = _caso()
    assert r["triangulacion"].iat[0] == "sin_evidencia" and r["accion"].iat[0] is None


def test_umbral_de_area_dibujada_viene_de_config():
    debajo = _caso(area_cart=MIN_CART - 0.5)
    justo = _caso(area_cart=MIN_CART)
    assert not debajo["ev_cartografia"].iat[0]
    assert justo["ev_cartografia"].iat[0]


def test_a2_distingue_si_la_cartografia_respalda_la_diferencia():
    con = _caso(area_construida_reg=40.0, area_huella=60.0, area_cart=55.0)
    sin = _caso(area_construida_reg=40.0, area_huella=60.0, area_cart=40.0)
    assert con["A2"].iat[0] and con["triangulacion"].iat[0] == "dos_fuentes"
    assert sin["A2"].iat[0] and sin["triangulacion"].iat[0] == "solo_imagen"
    assert sin["accion"].iat[0] == "campo"


def test_uso_no_residencial_es_trabajo_de_oficina():
    grande = CFG["alertas"]["A1"]["huella_no_residencial_min_m2"] + 1
    r = _caso(area_huella=grande)
    assert r["NR"].iat[0] and r["triangulacion"].iat[0] == "solo_imagen"
    assert r["accion"].iat[0] == "oficina"


def test_propiedad_horizontal_y_otros_destinos_quedan_fuera():
    assert _caso(condicion="9", area_huella=80.0, area_cart=60.0)["triangulacion"].iat[0] is None
    assert _caso(destino="Comercial", area_huella=80.0, area_cart=60.0)["triangulacion"].iat[0] is None


def test_sin_huellas_no_hay_triangulacion():
    r = _caso(hay_huellas=False, area_huella=np.nan, area_cart=60.0)
    assert r["triangulacion"].iat[0] is None and r["accion"].iat[0] is None


def test_resumen_cuenta_cada_categoria_y_las_colas():
    filas = [
        dict(area_huella=80.0, area_cart=60.0),   # dos fuentes (A1)
        dict(area_huella=80.0, area_cart=0.0),    # solo imagen (A1)
        dict(area_huella=0.0, area_cart=60.0),    # solo cartografía
        dict(area_huella=0.0, area_cart=0.0),     # sin evidencia
    ]
    df = pd.concat([_caso(**k) for k in filas], ignore_index=True)
    r = consistencia.resumen(df)
    assert r["universo_sin_area"] == 4
    assert (r["dos_fuentes"], r["solo_imagen"], r["solo_cartografia"], r["sin_evidencia"]) == (1, 1, 1, 1)
    assert (r["a1_dos_fuentes"], r["a1_solo_imagen"]) == (1, 1)
    assert (r["cola_oficina"], r["cola_campo"]) == (1, 1)
