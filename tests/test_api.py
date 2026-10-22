import json

from fastapi.testclient import TestClient

from api import main


def test_api(tmp_path, monkeypatch):
    fc = {"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": None,
         "properties": {"npn": "1", "puntaje": 70, "A1": True, "A2": False, "A3": False}},
        {"type": "Feature", "geometry": None,
         "properties": {"npn": "2", "puntaje": 0, "A1": False, "A2": False, "A3": False}},
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
