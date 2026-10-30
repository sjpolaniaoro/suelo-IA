# Spec: Suelo-IA v1 (piloto Neiva Fest Reto Innova)

## 1. Resumen General

Suelo-IA es una aplicación web que cruza el registro catastral de Neiva con huellas de edificaciones detectadas por visión computacional, y prioriza qué predios revisar en campo. La versión 1 cubre un solo sector urbano (sector catastral 02 del número predial nacional; no es la comuna 2 de Neiva: en sus predios los dígitos de comuna y barrio son `00`) y lo muestra en un mapa 3D con una ficha por predio. Todo vive en el repositorio `github.com/sjpolaniaoro/suelo-IA`: el proceso de datos en Python, el frontend publicado en Vercel y una API mínima publicada en Render (plan gratuito).

## 2. Objetivos del Usuario

Los equipos de Gestión Catastral, Hacienda y Planeación de Neiva no tienen una forma sistemática de saber qué predios del registro no coinciden con lo construido. Las fuentes existen y son públicas (Registro 1, cartografía predial, Observatorio Inmobiliario Catastral), pero están separadas, y verificar exige visitas de campo costosas.

El Registro 1 (vigencia 2025) muestra la magnitud: de 76.892 predios urbanos habitacionales que no están en propiedad horizontal, 14.562 (18,9 %) figuran con área construida igual a cero. En el sector 02 son 1.064 de 4.111 (25,9 %). Algunos son lotes vacíos y otros, construcciones no registradas. El usuario necesita una lista corta y explicada de dónde mirar primero, no un avalúo automático.

Hay además una necesidad inmediata: el equipo radica el Anexo 2 de la convocatoria el 22 de octubre de 2026 a las 11:59 p. m. y sustenta con demo en vivo el 30 de octubre. La v1 debe existir en un repo público con una URL que el jurado pueda abrir.

## 3. Alcance Estricto

**Incluye (v1):**
- Repo público `suelo-IA` con esta estructura:
  - `pipeline/`: scripts de Python reproducibles (no notebooks) que leen los insumos y generan los datos del sector.
  - `notebooks/01_open_buildings_neiva.ipynb`: notebook de Colab, solo para extraer las huellas de Open Buildings v3 del área de Neiva. Lo corre una persona con su cuenta de Google y guarda el resultado en `data/raw/`.
  - `web/`: Vite + React + deck.gl + MapLibre. Lee archivos estáticos de `web/public/data/`. Se publica en Vercel.
  - `api/`: FastAPI con datos empaquetados en el repo. Se publica en Render (plan gratuito).
  - `README.md` en español: qué es, cómo correrlo, fuentes, licencias y limitaciones.
- Insumos:
  - Registro 1 (`CATASTRAL_REGISTRO1_20250505.xlsx`, 200.019 filas, 159.213 predios únicos). Columnas: DEPARTAMENTO, MUNICIPIO, NUMERO PREDIAL NACIONAL, TIPO DE REGISTRO, NUMERO DE ORDEN, TOTAL DE REGISTROS, DIRECCIÓN, DESTINO ECONOMICO, AREA TERRENO, AREA CONSTRUCCION, AVALUO, VIGENCIA, NUMERO PREDIAL ANTERIOR. No trae nombres ni documentos.
  - Shapefiles de la carpeta `Unidad_Espacial` de datos abiertos (editados en dic. 2024, sistema EPSG:9377, MAGNA-SIRGAS Origen Nacional; se reproyectan a EPSG:4326 para la web):
    - `Terrenos.shp`: 101.398 polígonos. Campos útiles: `name` (número predial de 30 dígitos) y `area_terre`. El sector 02 urbano tiene 4.889 terrenos.
    - `Construccion.shp`: 133.890 polígonos. Campos útiles: `name`, `area_const` y `numero_pis` (pisos; mediana 1, máximo 23).
  - Llave de cruce: los primeros 21 dígitos del número predial (hasta el código de terreno). Cruza el 96,5 % de los predios del sector 02 del Registro 1; el número completo solo cruza el 58,9 % porque las unidades en propiedad horizontal tienen códigos propios.
  - Open Buildings v3 (polígonos, con área y confianza), licencia CC BY 4.0 u ODbL.
- Estructura del número predial nacional (30 dígitos) usada por el pipeline: departamento [0:2], municipio [2:5], zona [5:7] (01 = urbano), sector [7:9], comuna [9:11], barrio [11:13], manzana [13:17], terreno [17:21], condición de propiedad [21] (0 = no PH, 9 = PH, 5 = mejora), edificio [22:24], piso [24:26], unidad [26:30].
- Deduplicación: el Registro 1 tiene varias filas por predio (una por propietario). Se toma una fila por número predial.
- Alertas por predio del sector 02, con parámetros en `pipeline/config.yaml`:
  - **A1, posible construcción no registrada:** destino Habitacional, condición 0, área construida registrada = 0, y huellas de Open Buildings dentro del terreno con área total ≥ 20 m² y confianza ≥ 0,70.
  - **NR, uso probablemente no residencial (revisar destino):** un predio que cumpliría A1 pero con huella ≥ 1.000 m² (`huella_no_residencial_min_m2` en `pipeline/config.yaml`). No recibe A1 ni puntaje de vivienda; la ficha pide verificar el uso real y el destino. Se agregó el 27-oct-2026 tras detectar que el predio de mayor huella era un edificio no residencial registrado como Habitacional.
  - **Triangulación registro-cartografía-imagen (A1 y A2):** cada alerta de área construida se contrasta con la cartografía oficial de construcciones (`Construccion.shp`) y con las huellas de imagen. `dos_fuentes` y `solo_cartografia` van a la cola «Conciliar en oficina»; `solo_imagen`, a «Verificar en campo»; `sin_evidencia` (probable lote vacío) no genera acción. No cambia el puntaje. El umbral de área dibujada vive en `pipeline/config.yaml` (`consistencia.cartografia_min_m2`). Se agregó el 27-oct-2026.
  - **A2, área construida subregistrada:** área de huellas dentro del terreno > 1,2 × área construida registrada (solo predios no PH con área construida > 0).
  - **A3, avalúo atípico:** el residuo de log(avalúo) frente a log(área terreno) y log(área construida), con efecto fijo de manzana (manzanas con 10 o más predios), es mayor a ln(2) en valor absoluto.
  - **Puntaje de prioridad** entre 0 y 100: A1 = 60, A2 = 30, A3 = 10, más un ajuste por área de huella detectada. Cada predio guarda la lista de razones en texto ("Huella detectada de 84 m², sin área construida registrada").
  - **Confianza:** baja si la confianza media de las huellas es < 0,75 o el terreno mide < 30 m².
- Salidas del pipeline:
  - `web/public/data/sector02.geojson`: un polígono por predio con npn, dirección, destino, áreas, avalúo, área de huella, alertas, puntaje, razones, confianza y altura de extrusión.
  - `web/public/data/resumen.json`: totales del sector y conteos por alerta.
  - `api/data/`: copia de ambos archivos.
- Mapa 3D:
  - Predios extruidos. Altura = máximo de `numero_pis` de las construcciones del terreno × 3 m; 0,5 m para terrenos sin construcción registrada. Las huellas de Open Buildings dentro de un terreno sin construcción registrada se dibujan como volumen aparte de 3 m en rojo translúcido.
  - Color por puntaje: gris (sin alerta), amarillo, naranja, rojo.
  - Panel de cifras del sector, filtro por tipo de alerta y ficha al hacer clic.
- Ficha por predio: lo registrado frente a lo observado (registro, cartografía e imagen, con la diferencia y el porcentaje de coincidencia entre cada par y la confianza de la imagen; estos datos siguen visibles aunque el predio se marque como OK), qué fuente contradice a cuál, razones, confianza, fuentes con fecha y un botón "Registrar revisión" (confirmado / descartado / no concluyente) que guarda en el navegador y exporta CSV.
- Revisiones en equipo (opcional, desde el 27-oct-2026): base de datos en Supabase (Postgres) de solo anexar (`db/migrations/`). El navegador solo llama a dos funciones, `registrar_revision` y `leer_revisiones`, que exigen un código de equipo (guardado como hash). Cada evento guarda npn, veredicto, nombre y grupo de quien revisa, un contacto opcional (correo o teléfono), la foto de la alerta (puntaje, alertas, triangulación, cola, versión de los datos) y dos marcas de tiempo: cuándo decidió la persona (`fecha_cliente`) y cuándo recibió el servidor el dato (`creada_en`). Cada persona se identifica en una barra encima de los filtros (nombre y grupo obligatorios; contacto y código de equipo opcionales) y sin identificarse no se registran revisiones. No se deduplica: varias personas, o la misma, pueden revisar el mismo predio y cada intento queda como una fila para analizarlo después. El contacto no se devuelve a otros clientes. Sin el código, las revisiones siguen quedando solo en el navegador y el frontend funciona sin la base. El pipeline sigue sin leer ni escribir nombres.
- API en Render: `GET /health`, `GET /sectores/02/resumen`, `GET /predios/{npn}`, `GET /alertas?tipo=A1&limit=50`. CORS abierto solo para el dominio de Vercel.
- Créditos visibles en el mapa: Open Buildings (Google Research), Registro 1 y cartografía (Alcaldía de Neiva) y OpenStreetMap si se usa el mapa base.

**No incluye (v1):**
- RAG o consulta normativa del POT. Es la versión 2, financiada con el incentivo.
- Índice de subutilización del suelo y valor por zona. Son la fase 3.
- Serie temporal 2016-2023 de Open Buildings (alturas y crecimiento). Pasa a v1.1, antes del 30 de octubre, si alcanza el tiempo.
- Otros sectores, zona rural y ciudad completa.
- Cuentas de usuario y autenticación completa. La revisión en equipo usa un código compartido y el nombre, grupo y contacto opcional de quien revisa (ver «Incluye»).
- Datos del Observatorio Inmobiliario Catastral.
- Cualquier cálculo de impuesto, avalúo nuevo o cobro.

## 4. Comportamiento Esperado

**Flujo normal:**
1. Una persona corre el notebook de Colab y deja `data/raw/open_buildings_neiva.csv` en el repo, o en una ruta local que el README indica.
2. `python pipeline/run.py` lee Registro 1, shapefiles y Open Buildings; filtra zona 01, sector 02; cruza por número predial; calcula alertas, puntaje y razones; escribe los GeoJSON y el resumen, y muestra en consola los conteos.
3. El usuario abre la URL de Vercel. El mapa carga el sector 02 en 3D, centrado, con el panel de cifras: predios del sector, predios con alerta por tipo y predios priorizados.
4. El usuario filtra por "A1" y ve solo los predios con posible construcción no registrada, ordenados por puntaje en una lista lateral.
5. Hace clic en un predio y abre la ficha: dirección, número predial, área construida registrada (0 m²), área de huella detectada (por ejemplo 96 m²), confianza, razones y fuentes con fecha.
6. Marca "Confirmado" y la revisión queda en el navegador. Al final exporta el CSV de revisiones.
7. Si la API de Render responde, la ficha se pide a `/predios/{npn}`; si no, se usa el GeoJSON estático.

**Casos de uso:**
- **Funcionario de Gestión Catastral:** filtra A1, toma los 20 predios con mayor puntaje y arma la ruta de visita de la semana. Exporta la lista en CSV.
- **Jurado en la sustentación del 30 de octubre:** abre la URL desde su celular, gira el mapa 3D, toca un predio rojo y lee en la ficha por qué está marcado y de qué fuente sale cada dato.
- **Equipo Suelo-IA validando el modelo:** revisa 50 predios con imagen satelital o visita, los marca como confirmado o descartado, exporta el CSV y calcula precisión y F1 para la sección 7 del Anexo 2.

## 5. Manejo de Errores

| Situación | Qué pasa |
|---|---|
| Un predio del Registro 1 no encuentra terreno con la llave de 21 dígitos (cerca del 3,5 % en el sector 02) | Queda en la lista con la marca "sin geometría" y no se dibuja. El pipeline reporta cuántos son. Si la tasa baja del 90 %, se detiene y avisa. |
| `numero_pis` vacío o en cero | Se usa 1 piso y la ficha dice "altura ilustrativa". |
| Open Buildings no está disponible al correr el pipeline | El pipeline corre igual y solo calcula A3; el mapa muestra el aviso "Evidencia de imágenes pendiente". |
| Huella de Open Buildings que cae entre dos terrenos | Se asigna por intersección: cada terreno recibe solo el área que cae dentro de él. |
| Predio en propiedad horizontal (condición 9) | No recibe A1 ni A2. La ficha explica que el área se registra por unidad. |
| Avalúo, área de terreno o área construida en cero o vacíos | Ese predio queda fuera del modelo A3 y la ficha lo muestra como dato faltante, no como cero. |
| Manzana con menos de 10 predios | No se calcula A3 para esa manzana. |
| La API de Render está dormida (plan gratuito, arranque en frío de unos 50 s) o caída | El frontend usa los archivos estáticos sin bloquear la pantalla y muestra "Modo sin conexión a la API". |
| El navegador no permite almacenamiento local | Las revisiones se guardan en memoria y se avisa que se pierden al cerrar; el CSV sigue disponible. |
| GeoJSON mayor a 15 MB | El pipeline simplifica geometrías (tolerancia 0,5 m) y redondea coordenadas a 6 decimales antes de escribir. |
| Datos personales | El pipeline nunca lee ni escribe nombres o documentos. Si una columna nueva los trae, falla con error explícito. |
| Una persona intenta registrar una revisión sin nombre y grupo | La ficha deshabilita los botones y los atajos no registran: el foco pasa a la barra de identidad. |
| Celular en horizontal o en vertical | En vertical, la ficha es una hoja inferior; en horizontal con poca altura, un panel a un lado, y el mapa se vuelve a centrar al girar. |
