import pandas as pd
import pytest

from pipeline import registro1


def test_descomponer_npn():
    npn = pd.Series(["410010102000000010003000000000"])
    d = registro1.descomponer_npn(npn)
    assert d.loc[0, "zona"] == "01"
    assert d.loc[0, "sector"] == "02"
    assert d.loc[0, "condicion"] == "0"
    assert len(d.loc[0, "llave21"]) == 21


def test_falla_con_datos_personales():
    with pytest.raises(registro1.DatosPersonalesError):
        registro1.validar_sin_datos_personales(
            ["NUMERO PREDIAL NACIONAL", "NOMBRE PROPIETARIO"], ["nombre", "propietario"]
        )


def test_columnas_limpias_pasan():
    registro1.validar_sin_datos_personales(
        ["NUMERO PREDIAL NACIONAL", "DIRECCI�N", "AVALUO"], ["nombre", "cedula"]
    )
