# Suelo-IA

Inteligencia territorial para apoyar la revisión catastral de Neiva. Cruza el registro catastral publicado como dato abierto por la Dirección de Gestión Catastral con huellas de edificaciones detectadas por visión computacional (Google Open Buildings) y prioriza qué predios revisar. Piloto: sector urbano 02.

Proyecto presentado a la Convocatoria Pública 001 de 2026, Neiva Fest Reto Innova.

- Especificación: [`docs/spec.md`](docs/spec.md)
- Plan de tareas: [`docs/plan-de-tareas.md`](docs/plan-de-tareas.md)
- Plan de desarrollo (arquitectura por capas, despliegue y roadmap): [`docs/plan-de-desarrollo.md`](docs/plan-de-desarrollo.md)

Estado: v1 con datos reales del sector 02 (corrida del 22-oct-2026). El pipeline reproduce todas las cifras de control del spec y genera `web/public/data/` y `api/data/` (resultados en `resumen.json`: 7.329 predios dibujados, 268 sin geometría, A1 = 807, A2 = 414, A3 = 90). Son alertas para priorizar revisión, no hallazgos confirmados.

## Demo en línea
- Landing y mapa 3D (Vercel): https://suelo-ia-knwnic.vercel.app (la landing está en `/` y el mapa en `/app/`, p. ej. `/app/?predio=NÚMERO` abre la ficha de un predio)
- API (Render, plan gratuito; el primer pedido puede tardar ~50 s en despertar): https://suelo-ia-api.onrender.com
- El mapa funciona sin la API: usa los archivos de `web/public/data/` y avisa "Modo sin conexión a la API" si no responde.

## Cómo correrlo

```bash
python -m venv .venv && .venv/Scripts/activate      # en Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
python -m pipeline.fuentes unidad-espacial          # Terrenos y Construccion (Drive abierto)
python -m pipeline.fuentes open-buildings           # huellas de Open Buildings v3 (o notebooks/01_...ipynb en Colab)
python -m pipeline.run                              # escribe web/public/data/ y api/data/
cd web && npm install && npm run dev                # mapa en http://localhost:5173
uvicorn main:app --app-dir api --reload             # API opcional en http://localhost:8000
```

El Registro 1 (`CATASTRAL_REGISTRO1_20250505.xlsx`) se copia a `data/raw/`. El pipeline también acepta rutas propias (`--registro`, `--terrenos`, `--construcciones`, `--huellas`). Si faltan las huellas, calcula solo A3 y el mapa avisa "Evidencia de imágenes pendiente".

## Qué verifica el pipeline
Se detiene y reporta si un conteo no coincide con el spec. Con el Registro 1 real ya coinciden: 159.213 predios únicos, 4.111 habitacionales no PH en el sector 02 y 1.064 sin área construida. Falla con error explícito si el insumo trae columnas de datos personales.

## Estructura
`pipeline/` datos (Python) · `web/` mapa 3D (React, deck.gl, MapLibre; Vercel) · `api/` FastAPI (Render, plan gratuito; `render.yaml`) · `notebooks/` extracción de Open Buildings · `tests/` pruebas.

## Pendiente
- Completar el Anexo 2 con los textos de [`docs/anexo2-ajustes.md`](docs/anexo2-ajustes.md).
- Revisar con imagen o visita los 70 predios de [`docs/validacion/muestra.csv`](docs/validacion/muestra.csv) (llenar `veredicto`) y calcular precisión, exhaustividad y F1: `python -m pipeline.validacion metricas docs/validacion/muestra.csv`.

Licencia del código: MIT ([`LICENSE`](LICENSE)); datos de terceros según [`LICENCIAS.md`](LICENCIAS.md).

Las salidas son indicativas: priorizan qué verificar y no modifican avalúos ni generan cobros.
