# Suelo-IA

Inteligencia territorial para apoyar la revisión catastral de Neiva. Cruza el registro catastral publicado como dato abierto por la Dirección de Gestión Catastral con huellas de edificaciones detectadas por visión computacional (Google Open Buildings) y prioriza qué predios revisar. Piloto: sector urbano 02.

Proyecto presentado a la Convocatoria Pública 001 de 2026, Neiva Fest Reto Innova.

- Especificación: [`docs/spec.md`](docs/spec.md)
- Plan de tareas: [`docs/plan-de-tareas.md`](docs/plan-de-tareas.md)
- Plan de desarrollo (arquitectura por capas, despliegue y roadmap): [`docs/plan-de-desarrollo.md`](docs/plan-de-desarrollo.md)

Estado: v1 en construcción. El pipeline, la API y el mapa 3D están implementados y probados con insumos sintéticos; falta correr el pipeline con los shapefiles y las huellas reales (ver "Pendiente").

## Cómo correrlo

```bash
python -m venv .venv && .venv/Scripts/activate      # en Linux/Mac: source .venv/bin/activate
pip install -r requirements.txt
python -m pipeline.fuentes unidad-espacial          # Terrenos y Unidad de Construcción (Drive abierto)
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
- Descargar `Terrenos` y `Unidad de Construccion` (el spec los llama `Construccion.shp`) y las huellas, y correr el pipeline para obtener los datos reales del sector 02.
- Los datos de `web/public/data/` y `api/data/` están ignorados en git mientras sean sintéticos; al publicar los reales, quitar esas líneas de `.gitignore`.
- Desplegar en Vercel (`web/`) y Render (`render.yaml`) y completar las URL en el Anexo 2, sección 6.
- Definir la licencia del código (ver [`LICENCIAS.md`](LICENCIAS.md)).

Las salidas son indicativas: priorizan qué verificar y no modifican avalúos ni generan cobros.
