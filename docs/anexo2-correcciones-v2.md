# Correcciones al Anexo 2 (v2): secciones 4, 5, 6, 8 y 11

Textos listos para pegar en la copia v2 del Anexo 2 (preparados el 27-oct-2026). El Anexo radicado el 22-oct y el documento de Drive **no se modificaron**; esta v2 es para la sustentación o para un reenvío si la Fundación lo permite. Las cifras salen de `web/public/data/resumen.json` (corrida del pipeline del 26-oct-2026, hora de Colombia). Este documento **reemplaza la sección 1 («Sección 6») de [`anexo2-ajustes.md`](anexo2-ajustes.md)**, cuyo texto citaba la corrida anterior (sin la marca NR) y 13 pruebas.

Por qué estas correcciones: la evaluación del Anexo encontró afirmaciones que el código no respalda (scikit-learn, «modelo propio»), una tabla de fuentes duplicada, marcadores sin llenar en la sección 6 y un perfil incompleto. El criterio de la rúbrica de IA responsable premia declarar con exactitud lo implementado frente a lo previsto.

---

## Sección 4. Arquitectura y componente sustancial de IA

**4.1. Tabla de módulos: reemplaza la fila «Priorización (v1)»**

| Módulo | Técnica | Entrada y salida |
|---|---|---|
| Priorización (v1) | Reglas explícitas y modelo estadístico de anomalías | Registro y evidencia observada → puntaje de prioridad (0 a 100), razones y confianza por predio. |

**4.2. Reemplaza el párrafo «El modelo de priorización es propio. Cruza tres señales…»**

> La priorización de la versión 1 combina reglas explícitas con un modelo estadístico; no entrena una red neuronal ni un modelo de aprendizaje automático propio. Cada predio del sector se evalúa con tres alertas cuyos umbrales viven en un archivo de configuración y no en el código. A1, posible construcción no registrada: destino habitacional, sin propiedad horizontal, área construida registrada igual a cero y huellas detectadas de al menos 20 m² con confianza media de 0,70 o más. A2, posible área subregistrada: área de huellas mayor a 1,2 veces el área construida registrada. A3, avalúo atípico: residuo del logaritmo del avalúo frente a los logaritmos del área de terreno y del área construida, con efecto fijo de manzana, mayor a ln 2 en valor absoluto, solo en manzanas con 10 o más predios. El puntaje de 0 a 100 suma 60 puntos por A1, 30 por A2 y 10 por A3, más un ajuste de hasta 10 puntos según el área de huella detectada. Una huella de 1.000 m² o más bajo destino habitacional sin área construida no se trata como vivienda sin registrar: se marca NR (uso probablemente no residencial, revisar destino) y queda fuera del puntaje de vivienda. Cada predio guarda la lista de razones en texto y un nivel de confianza (baja si la confianza media de las huellas es menor a 0,75 o el terreno mide menos de 30 m²).

**4.3. Párrafo nuevo, después del anterior: qué es de terceros y qué es propio**

> La detección de edificaciones es de terceros: Suelo-IA usa los polígonos de Google Open Buildings v3 y no entrena ni ajusta un modelo de visión. Lo propio del equipo es el cruce con el registro y la cartografía predial, las reglas y el modelo estadístico de anomalías, el puntaje con sus razones, la ficha de evidencia y el flujo de revisión humana. Se declara esta separación para que la evaluación recaiga sobre la integración y la priorización, y no sobre una detección que no es del equipo.

**4.4. Reemplaza «Herramientas: Python (GeoPandas, scikit-learn) para el proceso de datos…»**

> Herramientas: Python (GeoPandas, pandas y NumPy) para el proceso de datos; React con deck.gl y MapLibre para el mapa 3D, publicado en Vercel; FastAPI publicada en Render para la API; repositorio en GitHub. La versión 2 suma una base vectorial y un proveedor de LLM. scikit-learn queda reservado para el módulo de valor por zona de la fase 3, que se validará por bloques espaciales para reducir la contaminación entre entrenamiento y prueba (Roberts et al., 2017). No se requiere entrenar un modelo fundacional propio.

**4.5. Agregar al final del párrafo de Open Buildings** (ya estaba en `anexo2-ajustes.md`)

> En la versión 1, las huellas de Open Buildings v3 se usan como evidencia de presencia y área; la serie temporal de alturas 2016-2023 se incorpora en la versión 1.1. La altura de extrusión del mapa 3D proviene de los pisos de la cartografía de construcciones (3 m por piso) y se indica como ilustrativa cuando falta el dato.

**4.6. Párrafo nuevo, al final de la sección: evaluación**

> Para medir la calidad se preparó una muestra de 240 predios del sector 02: los 50 de mayor puntaje, 130 aleatorios estratificados por tipo de alerta (60 de A1, 40 de A2 y 30 de A3) y 60 predios sin alerta como control. Una persona revisa cada predio con imagen satelital o visita y registra confirmado, descartado o no concluyente. Se reportarán la precisión estimada ponderada por estrato con su intervalo de confianza al 95 %, la exhaustividad y el F1 estimados; la precisión de los 50 predios de mayor puntaje se informa aparte porque sobrestima la del conjunto. A la fecha de este texto la revisión humana está pendiente y no se declara ninguna métrica.

**4.7. Párrafo nuevo, después de 4.2: triangulación** (cifras de `resumen.json`, corrida del 27-oct-2026)

> Cada alerta de área construida se contrasta con dos evidencias independientes del registro: la cartografía oficial de construcciones y las huellas de imagen. De 1.060 predios habitacionales sin propiedad horizontal con área construida registrada igual a cero, en 733 la cartografía y la imagen coinciden en contradecir el registro, en 152 solo la cartografía, en 74 solo la imagen y en 101 ninguna (probable lote vacío). Esa clasificación separa el trabajo en dos colas: conciliar en oficina (776 alertas A1 y A2) y verificar en campo (443). En A1, 732 de 805 alertas tienen también construcción dibujada en la cartografía. En A2 la cartografía respalda la diferencia solo en 44 de 414 casos; la validación de la sección 7 medirá si A2 sobrestima por la imagen. La triangulación no modifica el puntaje y no confirma hallazgos.

---

## Sección 5. Fuentes de datos, privacidad y seguridad

**5.1. Elimina la primera tabla** (la del borrador, con encabezado «Fuente prevista» y cinco filas). **Conserva solo esta**, que ya aparecía como segunda tabla:

| Fuente | Uso y control de incorporación |
|---|---|
| Registro 1 y cartografía predial de Gestión Catastral de Neiva | Publicados como datos abiertos (corte de mayo de 2025). El Registro 1 no incluye nombres ni documentos de propietarios. Se registra versión, fecha y condiciones de publicación. |
| POT y actos complementarios (v2) | Corpus normativo oficial y parámetros revisados por el equipo; identificación de artículo, página y acto aplicable. |
| Open Buildings | Evidencia estimada de edificaciones. Registro de versión, cobertura local y términos del producto utilizado (CC BY 4.0 u ODbL). |
| Cartografía oficial de referencia | Manzanas, límites, vías y capas de contexto. Cada conjunto tendrá fuente, fecha, escala y licencia. |
| Observatorio Inmobiliario Catastral (fase 3) | Ofertas del mercado con número predial, solo en uso agregado por zona. Se diferenciarán ofertas, transacciones y referencias catastrales. |

**5.2. Reemplaza el párrafo «Controles previstos: acceso por roles, conexiones HTTPS…»** (separa lo implementado de lo previsto)

> Controles implementados en la versión 1: el proceso de datos revisa las columnas del insumo y se detiene con un error explícito si aparece una de datos personales (nombre, propietario, documento, cédula, teléfono, correo o celular); las salidas publicadas son datos derivados del sector piloto y no contienen datos personales; los datos crudos quedan fuera del repositorio; las revisiones humanas se guardan solo en el navegador de quien revisa y se exportan a CSV, sin servidor; el formulario de solicitud de piloto de la portada prepara un correo en el navegador y no guarda datos; la demostración se sirve por HTTPS. Previstos para fases con datos de acceso restringido: acceso por roles, copias de respaldo, registros de auditoría sin datos personales innecesarios y revisión periódica de dependencias. El número predial identifica un predio, no a una persona; aun así, la versión pública se limita al sector piloto. Las consultas al proveedor de IA de la versión 2 contendrán únicamente los fragmentos y variables necesarios; su configuración y condiciones deberán revisarse antes de habilitar ese envío.

---

## Sección 6. Estado de madurez del prototipo / demostración

**Reemplaza** la línea «Repositorio: … Demostración: [URL de Vercel]. API: [URL de Render]. Estado declarado…» (la URL del repositorio en el radicado decía `sueloia`; la correcta es `suelo-IA`):

> Repositorio: https://github.com/sjpolaniaoro/suelo-IA. Demostración: https://suelo-ia-knwnic.vercel.app (el mapa 3D está en https://suelo-ia-knwnic.vercel.app/app/). API: https://suelo-ia-api.onrender.com (plan gratuito; el primer pedido puede tardar cerca de 50 s en despertar, y la demostración funciona sin ella). Estado declarado por el responsable técnico, 26 de octubre de 2026: están operativos el proceso de datos en Python, el mapa 3D con filtro por alerta, la ficha por predio con registro de revisión humana (guardada en el navegador y exportable a CSV) y la API con cuatro consultas. Se ejecutó con datos reales del sector urbano 02: Registro 1 (vigencia 2025), cartografía predial y huellas de Open Buildings v3. El proceso reproduce las cifras de control del diagnóstico (4.111 predios habitacionales no PH, 1.064 sin área construida, 4.889 terrenos) y cruza el 96,5 % de los predios con su terreno; 268 predios quedan sin geometría y no se dibujan. Resultado de la corrida del 26 de octubre de 2026 (no son hallazgos confirmados): 1.283 de 7.329 predios dibujados tienen alguna alerta de vivienda (A1 = 805, A2 = 414, A3 = 90; un predio puede tener más de una); 2 predios se marcan aparte como NR, uso probablemente no residencial, revisar destino; y 927 fichas tienen confianza baja. Pruebas realizadas: 25 pruebas automáticas del proceso de datos y de la API, y revisión manual de la interfaz. La validación con referencia independiente (sección 7) está pendiente y sus resultados no se declaran aquí. Si se usa un video de respaldo en la presentación, se identificará como tal.

---

## Sección 8. Viabilidad técnica, operativa y financiera

**8.1. Reemplaza el corchete «[Confirmar dedicación, tarifas internas y presupuesto del piloto]»**

> Los supuestos de la tabla fueron confirmados por el equipo el 26 de octubre de 2026.

**8.2. Párrafo nuevo, después de la tabla del presupuesto**

> El software del proceso de datos, la interfaz y la API es abierto, y la API de la versión 1 corre en el plan gratuito de Render. Esa dependencia tiene un costo operativo conocido: el servicio se suspende por inactividad y el primer pedido tarda cerca de 50 s. Se mitiga porque la demostración funciona sin la API, con los archivos incluidos en la página. Para uso institucional, el rubro de infraestructura contempla pasar a un servicio sin suspensión.

**8.3. Opcional (solo si el equipo lo acepta; es un compromiso, no un hecho)**

> Para la fase institucional se solicitará a Gestión Catastral de Neiva un acuerdo de acceso a datos con vigencia, responsable técnico y ambiente de prueba definidos. A la fecha no existe tal acuerdo; el piloto usa únicamente datos publicados como abiertos.

---

## Sección 11. Perfil del equipo de trabajo

**11.1. Guillermo Andrés Moreno Olarte.** Pegar el perfil de la copia local v2, redactado con su hoja de vida. **No se escribe aquí**: son datos personales de un tercero y no se versionan en el repositorio. Mientras no se pegue, el corchete «[Incorporar formación, experiencia pertinente y soportes del integrante]» sigue siendo un hueco visible en la sección que el jurado lee.

**11.2. Reemplaza el párrafo «El equipo coordinará entregables, revisión cruzada y control de versiones…»**

> El equipo coordina entregables, revisión cruzada y control de versiones en un repositorio público, donde consta la división del trabajo: la arquitectura de datos, el proceso en Python, la API y el despliegue están a cargo del responsable técnico, y la propuesta de identidad visual «Plano catastral» y la portada del proyecto (solicitudes 1 a 3 del repositorio) fueron aportadas por Juan Pablo Escamilla Mejía. Los perfiles y dedicaciones deben coincidir con la inscripción y sus soportes. La asesoría en urbanismo, catastro y protección de datos se incorporará según los requerimientos del piloto.

**11.3. Verificar antes de pegar:** el perfil de Sebastián de Jesús Polanía Orozco nombra a su empresa «Knwbic». En otros documentos del proyecto aparece como «Knwnic». Una de las dos es un error de digitación; confirmar el nombre registrado.

---

## Complementos opcionales, fuera de las cinco secciones

**Sección 1 (resumen), tercer párrafo.** El radicado dice «con un modelo propio que cruza esa evidencia con el registro» y «huellas y alturas… (2016-2023)». Reemplaza esa frase por:

> El componente de inteligencia artificial combina las huellas de edificaciones detectadas con visión computacional (Google Open Buildings v3, de terceros) con reglas y un modelo estadístico propios que cruzan esa evidencia con el registro y asignan a cada predio un puntaje de prioridad con sus razones. La serie temporal de alturas 2016-2023 se incorpora en la versión 1.1. La versión 2, financiada con el incentivo, agrega consulta normativa sobre el POT mediante recuperación de documentos (RAG).

**Sección 9, tabla de riesgos: fila nueva**

| Riesgo | Control propuesto | Evidencia de revisión |
|---|---|---|
| Equipamientos u otros usos no residenciales leídos como vivienda sin registrar | Las huellas de 1.000 m² o más bajo destino habitacional se marcan NR, salen del puntaje de vivienda y piden revisar el destino. | Lista de predios NR del resumen (2 en el sector 02) y su revisión humana. |

---

## Verificación de las cifras del diagnóstico (sección 2 del radicado)

Se recalcularon desde el Registro 1 real (habitacionales urbanos sin propiedad horizontal, por sector): el rango de 8,7 % a 25,9 % y la afirmación de que el sector 02 tiene la mayor proporción entre los nueve sectores urbanos **sí se reproducen** (sector 03: 8,7 %; sector 02: 25,9 %). Los totales también: 76.892 predios, 14.562 sin área construida, 18,9 %. No se verificaron aquí las cifras de «3.096 manzanas» ni «1,0 % se aleja más del doble».

| Sector | Predios | Sin área construida | % |
|---|---|---|---|
| 03 | 1.695 | 147 | 8,7 |
| 01 | 8.976 | 911 | 10,1 |
| 09 | 15.225 | 2.426 | 15,9 |
| 06 | 10.513 | 1.777 | 16,9 |
| 04 | 1.952 | 394 | 20,2 |
| 07 | 9.651 | 2.132 | 22,1 |
| 05 | 16.373 | 3.672 | 22,4 |
| 08 | 8.396 | 2.039 | 24,3 |
| 02 | 4.111 | 1.064 | 25,9 |

## Pendiente

- Pegar el perfil de Guillermo (11.1) y confirmar «Knwbic»/«Knwnic» (11.3).
- Decidir si se incluye 8.3 (compromiso de acuerdo con la Alcaldía).
- Alinear la diapositiva 9 del pitch con el reparto 35/25/15/15/10 % de la sección 12.
- Revisar los 240 predios para sustituir la frase «la revisión humana está pendiente» (4.6) por métricas reales.
