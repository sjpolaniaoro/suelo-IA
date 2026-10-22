# Ajustes propuestos al Anexo 2

Textos listos para pegar en el Anexo 2 (el documento está en Drive; no se modificó). Todas las cifras salen de la corrida del pipeline del 22-oct-2026 (`web/public/data/resumen.json`).

## 1. Sección 6: enlaces y estado declarado

Sustituir la línea «Repositorio: … Demostración: [URL de Vercel]. API: [URL de Render]. Estado declarado…» por:

> Repositorio: https://github.com/sjpolaniaoro/suelo-IA. Demostración: https://suelo-ia-knwnic.vercel.app (el mapa 3D está en https://suelo-ia-knwnic.vercel.app/app/). API: https://suelo-ia-api.onrender.com (plan gratuito; el primer pedido puede tardar cerca de 50 s en despertar, y la demostración funciona sin ella). Estado declarado por el responsable técnico, 22 de octubre de 2026: están operativos el proceso de datos en Python, el mapa 3D con filtro por alerta, la ficha por predio con registro de revisión humana (guardada en el navegador, con exportación a CSV) y la API con cuatro consultas. Se ejecutó con datos reales del sector urbano 02: Registro 1 (vigencia 2025), cartografía predial y huellas de Open Buildings v3. El proceso reproduce las cifras de control del diagnóstico (4.111 predios habitacionales no PH, 1.064 sin área construida, 4.889 terrenos) y cruza el 96,5 % de los predios con su terreno; 268 predios quedan sin geometría y no se dibujan. Pruebas realizadas: 12 pruebas automáticas del proceso de datos y de la API, y revisión manual de la interfaz. La validación con referencia independiente (sección 7) está pendiente y sus resultados no se declaran aquí.

Resultado del piloto para citar (no son hallazgos confirmados): 1.285 de 7.329 predios dibujados quedan con alguna alerta (A1 = 807, A2 = 414, A3 = 90) y 927 predios tienen confianza baja.

## 2. Enlace del repositorio
El Anexo (sección 6) usa `github.com/sjpolaniaoro/sueloia`; el repositorio real es `github.com/sjpolaniaoro/suelo-IA`. Corregir el enlace en el documento.

## 3. Sección 4: altura y evidencia temporal
El Anexo describe las alturas de Open Buildings 2.5D Temporal (2016-2023) como parte de la evidencia. En la v1 no se usan: la altura de extrusión sale de `numero_pis` de la cartografía de construcciones (3 m por piso, indicada como «altura ilustrativa» cuando falta el dato) y las huellas de Open Buildings v3 aportan solo área y confianza. Agregar al final del párrafo de Open Buildings:

> En la versión 1, las huellas de Open Buildings v3 se usan como evidencia de presencia y área; la serie temporal de alturas 2016-2023 se incorpora en la versión 1.1.

## 4. Sección 7: indicadores que ya se pueden calcular
La muestra de `docs/validacion/muestra.csv` tiene 240 predios en tres grupos: los 50 de mayor puntaje (casos más claros), 130 elegidos al azar entre los demás predios con alerta, estratificados por tipo (A1 = 60, A2 = 40, A3 = 30), y 60 predios sin alerta al azar como control. La precisión de los 50 primeros sobrestima la del conjunto, así que la cifra que se reporta es la **precisión estimada ponderada por estrato** con su intervalo de confianza; la exhaustividad se estima con la tasa de predios con diferencia confirmada entre los de control, escalada a los 4.361 predios sin alerta (sin propiedad horizontal). Se calculan con `python -m pipeline.validacion metricas docs/validacion/muestra.csv` y valen para el sector 02, no para el municipio.

Para cumplir la meta de «al menos 50 unidades» basta con revisar los primeros 50 de cada grupo; revisar más reduce el margen de error. Hasta que una persona revise la muestra, la tabla debe seguir diciendo «meta inicial por validar». La integridad de fichas y la cobertura del piloto sí se pueden reportar ya: 7.329 de 7.597 predios del Registro 1 en el sector con ficha revisable (96,5 %), con 268 excluidos por no cruzar con un terreno.

## 5. Sección 13: licencia
El repositorio queda con licencia MIT para el código (archivo `LICENSE`, con los tres integrantes como titulares del derecho de autor). Sustituir el hueco «[Definir titularidad, licencia y alcance de publicación con todos los autores]» por esa decisión una vez los tres autores la confirmen, y verificar que coincida con el Anexo 3.
