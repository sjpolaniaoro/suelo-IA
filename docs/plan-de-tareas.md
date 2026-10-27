# Plan de Tareas: Suelo-IA v1

Derivado de spec.md. Cada tarea se traza a una sección del spec. Objetivo de fecha: tareas 1 a 10 antes del cierre del 22 de octubre a las 11:59 p. m.; tareas 11 a 13 antes de la sustentación del 30 de octubre.

## Estado al 26 de octubre de 2026

| Tarea | Estado |
|---|---|
| 1 a 8 (estructura, notebook, Registro 1, cartografía, recorte, evidencia, alertas, exportación) | Hecho. El pipeline reproduce las cifras de control del spec y genera `web/public/data/` y `api/data/`. |
| 9 (mapa 3D y ficha) | Hecho y ampliado: proceso por etapas, ficha en tres pasos, atajos, enlace compartible, importación y exportación de CSV. La identidad visual vigente es «Plano catastral» (`docs/diseno-plano-catastral.md`, `web/DISENO.md`). |
| 10 (despliegue) | Hecho: Vercel (`web/`) y Render (`api/`, plan gratuito). URL en el README. |
| 11 (validar predios) | Preparado: muestra de 240 predios (`docs/validacion/muestra.csv`) y cálculo de métricas ponderadas. **Pendiente la revisión humana de los veredictos.** |
| 12 (serie temporal v1.1) | Pendiente. |
| 13 (demo de sustentación) | Pitch de 10 diapositivas preparado por el equipo. Falta confirmar el video de respaldo y la prueba desde celular. |

Cambios respecto al plan original: la capa de construcciones es `Construccion.shp` (con `numero_pis`), no `Unidad de Construccion.shp`; la validación pasó de 50 a 240 predios con muestreo estratificado; el sitio tiene portada en `/` y mapa en `/app/`; y se agregó una licencia MIT para el código.

## Tareas

1. **Crear el repo y la estructura base** (spec: 3, Incluye)
   - Qué hacer: en `github.com/sjpolaniaoro/suelo-IA` (público, ya creado), crear `pipeline/`, `notebooks/`, `web/` (Vite + React), `api/` (FastAPI), `data/raw/` (en `.gitignore`), `data/processed/`, `README.md` y `pipeline/config.yaml` con los umbrales de A1, A2 y A3 del spec.
   - Depende de: ninguna.

2. **Escribir el notebook de Open Buildings** (spec: 3, Insumos; 4, paso 1)
   - Qué hacer: notebook de Colab que descarga por streaming el archivo v3 de la celda S2 que cubre Neiva y filtra el rectángulo lon -75.34 a -75.22, lat 2.86 a 3.01. Guarda `open_buildings_neiva.csv` con área, confianza y geometría WKT en el Drive del usuario. Incluir instrucciones de una línea por celda.
   - Depende de: 1.

3. **Cargar y normalizar el Registro 1** (spec: 3, Insumos y estructura del número predial)
   - Qué hacer: `pipeline/registro1.py` lee el xlsx como texto, deduplica por número predial, convierte áreas y avalúo a número, descompone el número predial y valida que no existan columnas de nombres o documentos.
   - Depende de: 1.

4. **Cargar shapefiles y cruzar con el Registro 1** (spec: 3, Insumos; 5, filas 1 y 2)
   - Qué hacer: `pipeline/cartografia.py` lee `Terrenos.shp` y `Construccion.shp`, documenta los campos en el README, reproyecta de EPSG:9377 a EPSG:4326, cruza con el Registro 1 por los primeros 21 dígitos del número predial (96,5 % esperado en el sector 02), toma el máximo de `numero_pis` por terreno y reporta las tasas de cruce.
   - Depende de: 3.

5. **Recortar el sector piloto** (spec: 3, Incluye; 2)
   - Qué hacer: filtrar zona 01 y sector 02. Verificar que haya 4.111 predios habitacionales no PH y 1.064 sin área construida. Si no coincide, detenerse y reportar la diferencia.
   - Depende de: 4.

6. **Asignar huellas de Open Buildings a terrenos** (spec: 3, A1 y A2; 5, filas 3 y 4)
   - Qué hacer: `pipeline/evidencia.py` intersecta huellas con terrenos del sector, suma área por predio, guarda la confianza media y maneja el caso sin archivo de Open Buildings.
   - Depende de: 2, 5.

7. **Calcular alertas, puntaje, razones y confianza** (spec: 3, Alertas; 5, filas 5 a 7)
   - Qué hacer: `pipeline/alertas.py` implementa A1, A2 y A3 (regresión con efecto fijo de manzana), el puntaje de 0 a 100, las razones en texto y la confianza. Excluye PH de A1 y A2 y trata los vacíos como faltantes.
   - Depende de: 6.

8. **Exportar los datos del sector** (spec: 3, Salidas; 5, fila 10)
   - Qué hacer: `pipeline/run.py` orquesta las tareas 3 a 7 y escribe `sector02.geojson` y `resumen.json` en `web/public/data/` y `api/data/`. Simplifica si pesa más de 15 MB e imprime los conteos finales.
   - Depende de: 7.

9. **Construir el mapa 3D y la ficha** (spec: 3, Mapa 3D y Ficha; 4, pasos 3 a 6; 5, filas 8 y 9)
   - Qué hacer: en `web/`, una capa extruida de deck.gl sobre MapLibre con color por puntaje, panel de cifras, filtro por alerta, lista ordenada, ficha con fuentes y fechas, botón de revisión con almacenamiento local y exportación CSV, aviso de modo sin API y créditos de datos.
   - Depende de: 8.

10. **Publicar la API en Render y el frontend en Vercel** (spec: 3, API; 4, paso 7; 5, fila 8)
    - Qué hacer: FastAPI con los 4 endpoints del spec leyendo `api/data/`, desplegada en Render (plan gratuito) con CORS para el dominio de Vercel. Frontend desplegado en Vercel desde `web/`. Probar ambas URL, incluido el caso de API dormida. Poner las URL en el README y en la sección 6 del Anexo 2.
    - Depende de: 9.

11. **Validar 50 predios** (spec: 4, caso de uso 3)
    - Qué hacer: tomar los 50 predios con mayor puntaje y una muestra de control. Revisarlos con imagen o visita, exportar el CSV y calcular precisión, exhaustividad y F1. Llevar el resultado a la sección 7 del Anexo 2.
    - Depende de: 10.

12. **Serie temporal 2016-2023 (v1.1)** (spec: 3, No incluye; se adelanta si hay tiempo)
    - Qué hacer: extraer con Earth Engine las alturas de Open Buildings Temporal para el sector, agregar un control de año en el mapa y medir construcciones nuevas entre 2016 y 2023.
    - Depende de: 10.

13. **Preparar la demo de sustentación** (spec: 4, caso de uso 2)
    - Qué hacer: guion de 15 minutos con el recorrido del flujo normal, video de respaldo y prueba desde celular.
    - Depende de: 10 (y 11 si está lista).
