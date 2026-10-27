import json

from fastapi.testclient import TestClient

from api import main


def test_api(tmp_path, monkeypatch):
    fc = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": None,
         "properties": {"npn": "1", "puntaje": 70, "A1": True, "A2": False, "A3": False,
                        "accion": "oficina"}},
        {"type": "Feature", "geometry": None,
         "properties": {"npn": "2", "puntaje": 0, "A1": False, "A2": False, "A3": False}},
        {"type": "Feature", "geometry": None,
         "properties": {"npn": "3", "puntaje": 0, "A1": False, "A2": False, "A3": False,
                        "NR": True, "area_huella": 3845}},
    ]}
    (tmp_path / "sector02.geojson").write_text(json.dumps(fc), encoding="utf-8")
    (tmp_path / "resumen.json").write_text("{}", encoding="utf-8")
    (tmp_path / "manifiesto.json").write_text("{}", encoding="utf-8")
    monkeypatch.setattr(main, "DATOS", tmp_path)
    main._cache.clear()
    c = TestClient(main.app)
    assert c.get("/health").json() == {"estado": "ok"}
    assert c.get("/predios/1").status_code == 200
    assert c.get("/predios/9").status_code == 404
    assert [p["npn"] for p in c.get("/alertas?tipo=A1").json()["predios"]] == ["1"]
    assert c.get("/alertas?tipo=Z9").status_code == 422
    # NR (uso probablemente no residencial) no entra en el ranking de vivienda, pero se consulta aparte.
    assert [p["npn"] for p in c.get("/alertas").json()["predios"]] == ["1"]
    assert [p["npn"] for p in c.get("/alertas?tipo=NR").json()["predios"]] == ["3"]
    # Cola de trabajo de la triangulación.
    assert [p["npn"] for p in c.get("/alertas?accion=oficina").json()["predios"]] == ["1"]
    assert c.get("/alertas?accion=campo").json()["total"] == 0
    assert c.get("/alertas?accion=otra").status_code == 422
