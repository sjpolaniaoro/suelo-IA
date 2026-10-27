# Ajustes al Anexo 2

Textos aplicados a la copia v2 del Anexo 2 (26-oct-2026). El Anexo radicado el 22-oct y el documento de Drive **no se modificaron**; la v2 es una copia para la sustentación o para un reenvío si la Fundación lo permite. Las cifras salen de la corrida del pipeline del 22-oct-2026 (`web/public/data/resumen.json`).

## 1. Sección 6: enlaces y estado declarado
Reemplaza la línea «Repositorio: … Demostración: [URL de Vercel]. API: [URL de Render]. Estado declarado…»:

> Repositorio: https://github.com/sjpolaniaoro/suelo-IA. Demostración: https://suelo-ia-knwnic.vercel.app (el mapa 3D está en https://suelo-ia-knwnic.vercel.app/app/). API: https://suelo-ia-api.onrender.com (plan gratuito; el primer pedido puede tardar cerca de 50 s en despertar, y la demostración funciona sin ella). Estado declarado por el responsable técnico, 26 de octubre de 2026: están operativos el proceso de datos en Python, el mapa 3D con filtro por alerta, la ficha por predio con registro de revisión humana (guardada en el navegador, con exportación a CSV) y la API con cuatro consultas. Se ejecutó con datos reales del sector urbano 02: Registro 1 (vigencia 2025), cartografía predial y huellas de Open Buildings v3. El proceso reproduce las cifras de control del diagnóstico (4.111 predios habitacionales no PH, 1.064 sin área construida, 4.889 terrenos) y cruza el 96,5 % de los predios con su terreno; 268 predios quedan sin geometría y no se dibujan. Resultado de la corrida del 22 de octubre de 2026 (no son hallazgos confirmados): 1.283 de 7.329 predios dibujados quedan con alguna alerta de vivienda (A1 = 805, A2 = 414, A3 = 90; un predio puede tener más de una) y 2 predios con huella superior a 1.000 m² bajo destino Habitacional se marcan aparte como NR, uso probablemente no residencial: revisar destino, sin puntaje de vivienda y 927 fichas tienen confianza baja. Pruebas realizadas: 13 pruebas automáticas del proceso de datos y de la API, y revisión manual de la interfaz. La validación con referencia independiente (sección 7) está pendiente y sus resultados no se declaran aquí.

## 2. Sección 4: altura y evidencia temporal
Agregar al final del párrafo de Open Buildings:

> En la versión 1, las huellas de Open Buildings v3 se usan como evidencia de presencia y área; la serie temporal de alturas 2016-2023 se incorpora en la versión 1.1. La altura de extrusión del mapa 3D proviene de los pisos de la cartografía de construcciones (3 m por piso) y se indica como ilustrativa cuando falta el dato.

## 3. Sección 7: indicadores
- **Cobertura del piloto**, se agrega a la meta: «Observado en la corrida del 22-oct-2026: 7.329 de 7.597 predios del Registro 1 del sector con ficha revisable (96,5 %); 268 excluidos por no cruzar con un terreno.»
- **Calidad de detección**, se agrega a la meta: «Muestra preparada: 240 predios del sector 02 (50 de mayor puntaje, 130 aleatorios estratificados por tipo de alerta y 60 sin alerta como control); se reportarán la precisión ponderada por estrato con su intervalo de confianza y la exhaustividad y el F1 estimados.» Sigue diciendo «por validar» hasta que una persona revise la muestra.

La precisión de los 50 predios de mayor puntaje sobrestima la del conjunto; por eso la cifra que se reporta es la precisión estimada ponderada por estrato. La exhaustividad se estima con los predios sin alerta (4.361 sin propiedad horizontal). Se calculan con `python -m pipeline.validacion metricas docs/validacion/muestra.csv` y valen para el sector 02, no para el municipio.

## 4. Sección 13: licencia
Reemplaza el hueco «[Definir titularidad, licencia y alcance de publicación con todos los autores]»:

> A la fecha, el repositorio público declara licencia MIT para el código propio (archivo LICENSE, a nombre de los tres integrantes) y los datos de terceros conservan sus propias licencias (archivo LICENCIAS.md); la titularidad y el alcance de publicación se confirmarán con los tres autores.

## Pendiente en el Anexo 2 (no resuelto por estos ajustes)
- Sección 8: `[Confirmar dedicación, tarifas internas y presupuesto del piloto]`.
- Sección 11: `[Incorporar formación, experiencia pertinente y soportes del integrante]` (perfil de Guillermo Andrés Moreno Olarte).
- Distribución del incentivo: la sección 12 del Anexo (35/25/15/15/10 %) no coincide con la diapositiva 9 del pitch (40/25/20/10/5 %). Decidir cuál rige y alinear el otro documento.
