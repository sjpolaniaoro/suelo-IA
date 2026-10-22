import pytest

from pipeline import validacion


def _f(grupo, v):
    return {"grupo": grupo, "npn": "x", "veredicto": v}


def test_metricas():
    filas = [_f("prioridad", "confirmado")] * 8 + [_f("prioridad", "descartado")] * 2 + [
        _f("control", "confirmado"), _f("control", "descartado"), _f("prioridad", "no_concluyente")]
    m = validacion.metricas(filas)
    assert m["precision"] == pytest.approx(0.8)
    assert m["exhaustividad"] == pytest.approx(8 / 9)
    assert m["no_concluyentes"] == 1


def test_veredicto_vacio_falla():
    with pytest.raises(ValueError):
        validacion.metricas([_f("prioridad", "")])
