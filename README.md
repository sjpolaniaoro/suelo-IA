# Suelo-IA

Inteligencia territorial para apoyar la revisión catastral de Neiva. Cruza el registro catastral publicado como dato abierto por la Dirección de Gestión Catastral con huellas de edificaciones detectadas por visión computacional (Google Open Buildings) y prioriza qué predios revisar. Piloto: sector urbano 02.

Proyecto presentado a la Convocatoria Pública 001 de 2026, Neiva Fest Reto Innova.

- Especificación: [`docs/spec.md`](docs/spec.md)
- Plan de tareas: [`docs/plan-de-tareas.md`](docs/plan-de-tareas.md)
- Plan de desarrollo (arquitectura por capas, despliegue y roadmap): [`docs/plan-de-desarrollo.md`](docs/plan-de-desarrollo.md)
- Identidad visual «Plano catastral» y portada: [`docs/diseno-plano-catastral.md`](docs/diseno-plano-catastral.md) y [`web/DISENO.md`](web/DISENO.md)
- Ajustes aplicados al Anexo 2: [`docs/anexo2-ajustes.md`](docs/anexo2-ajustes.md)

Estado (26-oct-2026): v1 desplegada con datos reales del sector 02 (corrida del 22-oct-2026); 13 pruebas automáticas en verde. El pipeline reproduce todas las cifras de control del spec y genera `web/public/data/` y `api/data/` (resultados en `resumen.json`: 7.329 predios dibujados, 268 sin geometría, A1 = 807, A2 = 414, A3 = 90). Son alertas para priorizar revisión, no hallazgos confirmados.

## Demo en línea
- Portada y mapa 3D (Vercel): https://suelo-ia-knwnic.vercel.app (la portada está en `/` y el mapa en `/app/`, p. ej. `/app/?predio=NÚMERO` abre la ficha de un predio). La solicitud de piloto de la portada prepara un correo en el navegador; no se guarda ni se envía a ningún servidor.
- API (Render, plan gratuito; el primer pedido puede tardar ~50 s en despertar): https://suelo-ia-api.onrender.com
- El mapa funciona sin la API: usa los archivos de `web/public/data/` y avisa "Modo sin conexión a la API" si no responde.

## Uso del mapa
El panel sigue el proceso de gestión de cada predio: **1 Detectados → 2 Por revisar → 3 Revisados → 4 Confirmados** (la barra avanza con cada veredicto). La clasificación se filtra por prioridad (alta, media, baja) y por tipo de alerta (A1, A2, A3). La ficha guía tres pasos: **qué se detectó**, **verificar en imagen** (satélite o Street View) y **decidir** (confirmado, descartado o no concluyente). Atajos: `C` confirmar, `D` descartar, `N` no concluyente, `S` siguiente sin revisar, `J`/`K` mover, `Esc` cerrar.

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
- **Revisión humana de la muestra:** revisar con imagen o visita los 240 predios de [`docs/validacion/muestra.csv`](docs/validacion/muestra.csv) (llenar `veredicto`; los primeros 50 de cada grupo ya son una muestra aleatoria válida) y calcular precisión, exhaustividad y F1 estimados: `python -m pipeline.validacion metricas docs/validacion/muestra.csv`.
- **Anexo 2:** incorporar el perfil de Guillermo Andrés Moreno Olarte (sección 11) y alinear la diapositiva 9 del pitch con el reparto del incentivo de la sección 12 (ver [`docs/anexo2-ajustes.md`](docs/anexo2-ajustes.md)).
- **Roadmap:** serie temporal 2016-2023 (v1.1) y consulta normativa (v2), según el plan de desarrollo.

Los documentos de la postulación (Anexos 3, 4 y 5 y el pitch) traen datos personales y no se versionan; se guardan localmente.

Licencia del código: MIT ([`LICENSE`](LICENSE)); datos de terceros según [`LICENCIAS.md`](LICENCIAS.md).

Las salidas son indicativas: priorizan qué verificar y no modifican avalúos ni generan cobros.
