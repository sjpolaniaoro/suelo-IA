# Plan de desarrollo: Suelo-IA v1 (autocontenido, freeware, 3D)

## Context

El repo `sjpolaniaoro/suelo-IA` tiene solo documentación (`README.md`, `CLAUDE.md`, `docs/spec.md`, `docs/plan-de-tareas.md`). El Anexo 2 (documento técnico de la convocatoria) fija lo que Suelo-IA promete: un mapa 3D del sector urbano 02 de Neiva que cruza el Registro 1 catastral con huellas de Open Buildings, prioriza predios con puntaje y razones (A1, A2, A3), y deja una ficha con fuentes, fechas, confianza y registro de revisión humana. Stack declarado: Python (GeoPandas, scikit-learn), React + deck.gl en Vercel, FastAPI en Render, GitHub. Licencias propuestas: MIT/Apache 2.0 para código, CC BY 4.0 para documentación.

Este plan ajusta el de `docs/plan-de-tareas.md` a una solución **autocontenida**: un solo repo, sin base de datos, sin servicios de pago, todo reproducible desde cero con herramientas freeware, y que se despliega en Render y Vercel. La consulta normativa (RAG) y la multiconsulta quedan solo como roadmap.

Fechas: radicación del Anexo 2 hoy 22-oct-2026 11:59 p. m.; demo en vivo el 30-oct.

## Inconsistencias a corregir (detectadas al leer el Anexo)

1. El Anexo (sección 6) enlaza `github.com/sjpolaniaoro/sueloia`; el repo real es `suelo-IA`. Corregir uno de los dos antes de radicar.
2. El Anexo (sección 4) habla de alturas 2016-2023 (Open Buildings Temporal) como evidencia v1; el spec deja eso en v1.1. En v1 la altura 3D sale de `numero_pis` de `Construccion.shp`, no de Open Buildings. Ajustar el texto o declararlo.
3. La sección 6 del Anexo tiene huecos por completar: URL de Vercel, URL de Render y estado declarado con fecha. Salen de la tarea de despliegue.
4. Vercel Hobby es para uso no comercial; está bien para el piloto, pero hay que declararlo en limitaciones si el proyecto pasa a uso institucional pago.

## Arquitectura por capas

```
FUENTES            INGESTA              CÓMPUTO              SERVICIO         PRESENTACIÓN
Registro 1 (xlsx)  pipeline/fuentes.py  pipeline/registro1   api/ (FastAPI)   web/ (React +
Terrenos/Constr.   descarga o carga     pipeline/cartografia   Render free     deck.gl +
Open Buildings v3  local + manifiesto   pipeline/evidencia   lee api/data     MapLibre)
                   + validación PII     pipeline/alertas                      Vercel hobby
                                        pipeline/run.py ──► web/public/data/
                                                       └──► api/data/
```

Principio de autocontención: el pipeline produce dos archivos (`sector02.geojson`, `resumen.json`) y un `manifiesto.json` de procedencia; el frontend los lee como estáticos y funciona solo; la API empaqueta la misma copia y es opcional.

### Capa 1. Fuentes y conexiones actuales (`pipeline/fuentes.py`)

Un módulo que declara cada fuente en `pipeline/fuentes.yaml` (nombre, URL, formato, licencia, fecha de corte, hash) y ofrece dos caminos por fuente: **descarga** y **carga local**.

| Fuente | Conexión | Carga local (fallback) |
|---|---|---|
| Registro 1 (xlsx, corte 5-may-2025) | Carpeta pública de Drive de la Dirección de Gestión Catastral, descargada con `gdown` | `data/raw/CATASTRAL_REGISTRO1_20250505.xlsx` |
| `Terrenos.shp`, `Construccion.shp` (Unidad_Espacial) | Misma carpeta de datos abiertos, `gdown` | `data/raw/Unidad_Espacial/` |
| Open Buildings v3 (polígonos) | Archivos públicos por celda S2 en el bucket de Google (HTTP, sin cuenta); notebook de Colab como alternativa documentada | `data/raw/open_buildings_neiva.csv` |
| Mapa base | OpenStreetMap vía teselas vectoriales abiertas, o sin mapa base si no hay conexión | n/a |

Cada ejecución escribe `manifiesto.json`: fuente, URL, fecha de descarga, hash SHA-256, filas leídas y licencia. La ficha y el README citan ese manifiesto, de modo que las fechas de fuente que pide el Anexo salen del dato y no de texto escrito a mano.

Nota de verificación: las URL exactas de Drive y de la celda S2 de Neiva se confirman al ejecutar; si la descarga automática falla (cuota de Drive), el pipeline se detiene y pide la carga local con un mensaje claro.

### Capa 2. Carga de archivos

- **Pipeline (línea de comandos):** `python pipeline/run.py --registro RUTA --cartografia RUTA --huellas RUTA` o sin argumentos para usar `data/raw/`. Si falta Open Buildings, corre solo A3 y marca "Evidencia de imágenes pendiente" (spec, sección 5).
- **Control de datos personales:** `registro1.py` aborta si aparece una columna de nombre, documento o contacto (regla de `CLAUDE.md`).
- **Web, carga en el navegador (sin servidor):** botón "Cargar archivo" que acepta (a) un `sector*.geojson` generado por el pipeline, para ver otro sector sin redeploy, y (b) un CSV de revisiones previas para retomar el trabajo. Todo se procesa en el navegador; nada se sube a ningún servidor. Esto cumple "no hay base de datos ni usuarios" y evita problemas de datos personales.
- **Exportación:** CSV de revisiones (confirmado / descartado / no concluyente) y CSV de la lista priorizada.

### Capa 3. Cómputo (`pipeline/`)

Sigue el plan de tareas 3 a 8, sin cambios de lógica:
- `registro1.py`: lectura como texto, deduplicación por número predial, descomposición del número predial de 30 dígitos.
- `cartografia.py`: shapefiles EPSG:9377 → 4326, cruce por 21 dígitos, máximo de `numero_pis` por terreno.
- Recorte zona 01, sector 02 y verificación de cifras de control: 4.111 predios no PH habitacionales, 1.064 sin área construida, 4.889 terrenos, cruce ≈ 96,5 %. Si no coincide, se detiene y reporta.
- `evidencia.py`: intersección huella-terreno (cada terreno recibe solo lo que cae dentro).
- `alertas.py`: A1, A2, A3 (log-log con efecto fijo de manzana ≥ 10 predios), puntaje 0 a 100, razones en texto, confianza.
- `config.yaml`: todos los umbrales (20 m², confianza 0,70, 1,2×, ln 2, puntos 60/30/10).
- `run.py`: orquesta, simplifica si el GeoJSON pasa de 15 MB, imprime conteos y escribe a `web/public/data/` y `api/data/`.

Dependencias freeware: `pandas`, `geopandas`, `pyogrio`, `shapely`, `pyproj`, `openpyxl`, `numpy`/`statsmodels`, `pyyaml`, `gdown`, `requests`.

### Capa 4. API (`api/`, Render plan gratuito)

FastAPI con `GET /health`, `GET /sectores/02/resumen`, `GET /predios/{npn}`, `GET /alertas?tipo=A1&limit=50`. Lee `api/data/` en memoria al arrancar, sin base de datos. CORS solo para el dominio de Vercel. `render.yaml` en la raíz para crear el servicio con un clic (Blueprint). Arranque en frío ≈ 50 s: el frontend nunca depende de ella.

### Capa 5. Presentación 3D (`web/`, Vercel Hobby)

- Vite + React + deck.gl (`PolygonLayer` extruida) sobre MapLibre GL (ambos MIT/BSD).
- Altura = máx. `numero_pis` × 3 m; 0,5 m si no hay construcción; huellas sin construcción registrada como volumen rojo translúcido de 3 m.
- Color por puntaje (gris, amarillo, naranja, rojo), panel de cifras del sector, filtro por alerta, lista lateral ordenada, ficha con registrado frente a observado, razones, confianza, fuentes y fechas (desde el manifiesto), "Registrar revisión" en `localStorage` con respaldo en memoria, exportación CSV, aviso "Modo sin conexión a la API", créditos visibles (Open Buildings, Alcaldía de Neiva, OpenStreetMap).
- Lectura de datos: primero `/data/sector02.geojson` estático; la ficha pide a la API solo si responde en 3 s.
- Compatible con celular (el jurado puede abrirlo desde el teléfono).

### Capa 6. Despliegue y operación

- **Vercel:** proyecto con directorio raíz `web/`; `npm run build`; los datos van en `web/public/data/`. Variable `VITE_API_URL` apunta a Render.
- **Render:** servicio web Python desde `api/`, `uvicorn main:app`, plan gratuito, `render.yaml` versionado. Variable `ALLOWED_ORIGIN` con el dominio de Vercel.
- **GitHub Actions (freeware):** un flujo que corre `ruff` y las pruebas del pipeline con datos sintéticos pequeños y hace `npm run build`, para que cada commit quede verificado. Los datos reales no entran a CI.
- **Reproducibilidad:** `requirements.txt` con versiones fijas, `README.md` en español con "cómo correrlo en 5 comandos".

### Capa 7. Licencias y cumplimiento (todo freeware)

- Código propio: MIT (o Apache 2.0, a confirmar entre los tres autores; es un hueco abierto del Anexo 13).
- Documentación: CC BY 4.0.
- Datos de terceros: `LICENCIAS.md` con Open Buildings (CC BY 4.0 u ODbL), Registro 1 y cartografía (datos abiertos de la Alcaldía, con fecha de corte), OpenStreetMap (ODbL, con atribución).
- Dependencias: todas MIT/BSD/Apache; ningún componente de pago ni cuenta propietaria. Earth Engine solo en el roadmap (requiere cuenta; no se usa en v1).

## Secuencia de ejecución

1. **Hoy antes de las 11:59 p. m.** Estructura del repo, `registro1`, `cartografia`, recorte con cifras de control, `evidencia`, `alertas`, `run.py`, mapa 3D con ficha y filtro, despliegue en Vercel con datos estáticos, y llenar en el Anexo las URL y el estado de la sección 6. Si el tiempo aprieta, la API de Render va después de la radicación (el frontend ya funciona sin ella).
2. **Antes del 30-oct.** API en Render con CORS, carga de archivo en la web, CI, validación de 50 predios (precisión, exhaustividad, F1 para la sección 7), guion y video de respaldo de la demo.
3. **Fuera de v1 (solo si sobra tiempo):** serie temporal 2016-2023 (tarea 12).

## Archivos críticos

`pipeline/fuentes.py`, `pipeline/fuentes.yaml`, `pipeline/config.yaml`, `pipeline/{registro1,cartografia,evidencia,alertas,run}.py`, `notebooks/01_open_buildings_neiva.ipynb`, `web/src/` (mapa, panel, ficha, carga de archivo), `web/public/data/`, `api/main.py`, `api/data/`, `render.yaml`, `.github/workflows/ci.yml`, `LICENCIAS.md`, `README.md`. No hay código existente que reutilizar.

## Verificación

- Pipeline: `python pipeline/run.py` reproduce 4.111 / 1.064 / 4.889 / ≈96,5 %; falla con columna personal; corre solo A3 sin huellas; `manifiesto.json` completo.
- Web: `npm run build` sin errores; abrir con la API apagada (modo sin API) y encendida; filtro A1, ficha, revisión guardada, CSV exportado, carga de un GeoJSON propio; revisión en ancho de celular.
- API: `curl` a los cuatro endpoints y prueba de CORS desde el dominio de Vercel.
- Despliegue: URL de Vercel abre el mapa; `/health` de Render responde tras el arranque en frío.
- CI en verde en GitHub.

## Roadmap (no se construye en v1)

**v1.1:** serie temporal Open Buildings 2.5D 2016-2023 (alturas y construcción nueva por año) con control de año en el mapa.

**v2: consulta normativa y multiconsulta.** Corpus oficial del POT (Acuerdo 026 de 2009 y modificaciones) versionado y dividido por artículo y página; recuperación (RAG) con base vectorial abierta (por ejemplo Chroma o pgvector) y un LLM que responde solo con fragmentos citados o se abstiene. La **multiconsulta** combina en una sola pregunta varias fuentes: *"¿Qué predios del sector 02 con alerta A1 están en un uso del suelo que no permite esa construcción?"* se descompone en una consulta espacial (alertas y geometría), una consulta normativa (RAG sobre el POT) y una consulta de contexto (avalúo y manzana), y se responde con ficha y citas. Incluye un enrutador de consultas que decide qué fuente usar, registro de auditoría de cada consulta y evaluación con las 30 preguntas de la sección 7 del Anexo.

**Fase 3:** índice de subutilización (IS) con parámetros normativos revisados, y valor por zona con el Observatorio Inmobiliario Catastral, validado por bloques espaciales.

**Escala:** más sectores y comunas, zona rural con tipologías propias, ciclo anual de detección de cambios, y migración opcional a base de datos (PostGIS) y autenticación por roles cuando haya acuerdo institucional.

## Decisiones para confirmar antes de ejecutar

1. Corregir el enlace del repositorio en el Anexo (`sueloia` frente a `suelo-IA`) o renombrar el repo.
2. Licencia del código: MIT o Apache 2.0 (acordar con los tres autores).
3. Disponibilidad local del xlsx, de `Unidad_Espacial/` y del CSV de Open Buildings; quién corre el notebook de Colab si la descarga directa no funciona.
