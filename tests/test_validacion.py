import csv

import pytest

from pipeline import validacion

POB = {"alertas": {"A1": 800, "A2": 400, "A3": 60}, "control": 4000, "prioridad_top": 50}


def _f(grupo, est, v):
    return {"grupo": grupo, "estrato": est, "npn": "x", "veredicto": v}


def test_metricas_ponderadas():
    filas = (
        [_f("prioridad", "A1", "confirmado")] * 9 + [_f("prioridad", "A1", "descartado")]
        + [_f("aleatoria", "A1", "confirmado")] * 8 + [_f("aleatoria", "A1", "descartado")] * 2
        + [_f("aleatoria", "A2", "confirmado")] * 5 + [_f("aleatoria", "A2", "descartado")] * 5
        + [_f("aleatoria", "A3", "confirmado")] * 2 + [_f("aleatoria", "A3", "descartado")] * 8
        + [_f("control", "sin_alerta", "confirmado")] * 1 + [_f("control", "sin_alerta", "descartado")] * 19
        + [_f("control", "sin_alerta", "no_concluyente")]
    )
    m = validacion.metricas(filas, POB)
    assert m["precision_top"]["tasa"] == pytest.approx(0.9)
    # (800*0.8 + 400*0.5 + 60*0.2) / 1260
    assert m["precision_estimada"] == pytest.approx((640 + 200 + 12) / 1260)
    assert m["control"]["confirmados"] == 1 and m["no_concluyentes"] == 1
    assert m["falsos_negativos_estimados"] == 200  # 1/20 de 4000
    lo, hi = m["precision_ic95"]
    assert lo < m["precision_estimada"] < hi


def test_veredicto_invalido_falla_y_vacio_se_ignora():
    with pytest.raises(ValueError):
        validacion.metricas([_f("prioridad", "A1", "quizas")], POB)
    m = validacion.metricas([_f("prioridad", "A1", ""), _f("prioridad", "A1", "confirmado")], POB)
    assert m["pendientes"] == 1 and m["revisados"] == 1


def test_wilson():
    lo, hi = validacion.wilson(8, 10)
    assert 0.4 < lo < 0.8 < hi < 1.0
    assert validacion.wilson(0, 0) is None


def test_volcar_revisiones_llena_veredictos_de_la_muestra(tmp_path):
    muestra = tmp_path / "muestra.csv"
    base = {c: "" for c in validacion.COLUMNAS}
    filas = [{**base, "grupo": "prioridad", "npn": "1" * 30}, {**base, "grupo": "control", "npn": "2" * 30}]
    with open(muestra, "w", newline="", encoding="utf-8-sig") as fh:
        w = csv.DictWriter(fh, fieldnames=validacion.COLUMNAS)
        w.writeheader()
        w.writerows(filas)
    revisiones = tmp_path / "revisiones.csv"
    lineas = [
        "npn,estado,revisor",
        "1" * 30 + ",confirmado,Ana Pérez",
        "2" * 30 + ",quizas,Luis",
        "3" * 30 + ",descartado,Eva",
    ]
    revisiones.write_text("\n".join(lineas), encoding="utf-8-sig")
    r = validacion.volcar_revisiones(revisiones, muestra)
    assert r == {"aplicados": 1, "estado_invalido": 1, "fuera_de_la_muestra": 1}
    with open(muestra, encoding="utf-8-sig") as fh:
        sal = {f["npn"]: f for f in csv.DictReader(fh)}
    assert sal["1" * 30]["veredicto"] == "confirmado"
    assert sal["1" * 30]["observaciones"] == "revisor: Ana Pérez"
    assert sal["2" * 30]["veredicto"] == ""
