# Propuesta de PR: Suelo-IA, identidad «Plano catastral»

Documento de evaluación y encargo para Opus 5.5 u otro modelo ejecutor. Fecha: 22 de octubre de 2026, Colombia.

**Estado: propuesta de diseño, sin implementación.** Documento preparado para un PR que añada únicamente esta evaluación e instrucciones. Los cambios de interfaz descritos aquí corresponden a un PR de implementación futuro. El destinatario del encargo puede ser Opus 5.5 u otro modelo.

## 1. Dictamen de viabilidad

El cambio es viable con la arquitectura existente. Recomiendo aprobar la dirección «Plano catastral», corrigiendo el borrador original en accesibilidad, datos y alcance. El objetivo es que Suelo-IA se reconozca por su cartografía y su trabajo de revisión predial.

La landing permite una transformación amplia; el mapa requiere cambios más contenidos para preservar el flujo de trabajo. No hace falta cambiar Vite, React, MapLibre, deck.gl, la API ni el pipeline. El esfuerzo es medio y la principal dificultad está en comprobar la ficha, los estados de revisión y la adaptación móvil después de cambiar el CSS compartido.

Propuesta de entrega futura: un PR con dos bloques revisables —landing e identidad; después interfaz del mapa— y capturas comparables. Si la demostración del proyecto está cerca, conviene integrar primero la landing y separar el mapa en un segundo PR si sus comprobaciones no están completas. Esta es una recomendación de implementación, no una autorización para ejecutarla ahora.

## 2. Qué se verificó

- Repositorio [sjpolaniaoro/suelo-IA](https://github.com/sjpolaniaoro/suelo-IA), rama `main`, commit `6a31aa5b646b2943c1d5da800bb7b963f55f2ba2`.
- `CLAUDE.md`, especificación, plan de tareas, README, licencias, configuración de alertas y CI.
- HTML de ambas entradas, JavaScript y CSS de la landing, componentes del mapa, carga de datos, revisiones y JSON de resumen y manifiesto.
- Landings publicadas de [Suelo-IA](https://suelo-ia-knwnic.vercel.app/) y [Radar SECOP](https://proyecto-radar-secop.vercel.app/): contenido e imágenes de su estado actual.
- Índice de diseño de TodoDeIA y guía [11 sitios para diseñar con IA](https://www.tododeia.com/community/11-sitios-diseno-ia), consultada durante la revisión.
- Referencia primaria de [frontend-design de Anthropic](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md), leída como referencia; no instalada ni ejecutada.

**Límite de verificación:** `/app/` mostró los controles y el estado inicial de carga, pero después la pestaña falló en el navegador integrado. No se completó una prueba funcional del mapa ni se atribuye el fallo a una causa concreta. Las recomendaciones del mapa se apoyan en el código. No se auditó el código actual de Radar SECOP en GitHub ni se afirma una identidad literal entre todos los archivos de los dos proyectos.

## 3. Diagnóstico confirmado

La primera observación de `web/src/landing/landing.css` declara expresamente que la identidad se hereda de Radar SECOP. `web/src/styles.css` también identifica el tema compartido de azul noche, verde radar y Archivo/IBM Plex. [Fuente: CSS de la landing](https://github.com/sjpolaniaoro/suelo-IA/blob/6a31aa5b646b2943c1d5da800bb7b963f55f2ba2/web/src/landing/landing.css).

| Dimensión | Situación actual | Cambio propuesto |
|---|---|---|
| Primera impresión | Fondo oscuro, verde luminoso, barrido circular | Papel técnico claro, plano real, azul acero |
| Mensaje | Ambos usan «Llega primero…» | Explicar la revisión catastral y sus límites |
| Estructura | Beneficios, flujo automático, perfiles, confianza, planes, FAQ | Plano, cifras, ficha, leyenda, método y notas |
| Interacciones de presentación | Stepper automático y pestañas de perfiles | Lectura estática, ficha anotada y acordeones útiles |
| Marca | Círculo, verde y movimiento de radar | Símbolo de parcelas dentro de un marco abierto |

Los logos tienen dibujos interiores distintos; el parecido está en el marco circular y el lenguaje de radar. No son el mismo SVG. Cambiar solo la paleta dejaría intacta gran parte del parecido.

## 4. Cambios que haría al borrador recibido

1. **Separar identidad de semántica.** Usar azul acero para marca, enlaces y controles. Conservar rojo/naranja/amarillo para prioridad y los estados existentes en el mapa durante este PR. La especificación v1 los exige y los usuarios ya los relacionan con sus filtros. Incorporar etiquetas, símbolos y selección con borde; el color no debe ser la única señal. No renombrar las claves `rojo`, `naranja`, `amarillo`, `sin_alerta` ni los estados guardados.
2. **Oscurecer el botón principal.** Blanco sobre `#5980A6` da aproximadamente 4,15:1; falla el mínimo de 4,5:1 para texto normal. Propongo `#416180` con blanco, aproximadamente 6,47:1. Cálculo propio por luminancia relativa; no equivale a una auditoría de la página renderizada. [Criterio W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
3. **Evitar un plano recargado.** Las cuatro cruces de registro solo aparecen en la imagen principal y, si aporta jerarquía, en la ficha destacada. No en cada botón o marco. Nada de coordenadas, cotas, escala o norte inventados.
4. **Usar espaciado convencional.** Escala 4/8/12/16/24/32/48/64 px en lugar de múltiplos de 3,4 px. Facilita consistencia y mantenimiento.
5. **No duplicar cifras a mano.** El borrador exige cifras desde JSON y también valores iniciales escritos en HTML: esas reglas pueden producir divergencias. Para este PR, mantener carga desde el resumen, estados de carga legibles y «Cifras no disponibles» ante error. La ausencia de JavaScript debe dejar explicación y acceso al mapa. Una generación de cifras en build sería otra mejora explícita; no se exige aquí.
6. **Distinguir A1–A3 de prioridad.** Son reglas de alerta; un predio puede tener varias. No presentarlas como tres niveles ni sumar sus conteos para calcular predios únicos.
7. **No exigir borrar palabras funcionales.** Se debe retirar el lenguaje visual de radar; no prohibir en todo el código cadenas como `rojo`, `beneficio` o nombres genéricos de clases. Un buscador no sustituye la comparación visual ni la prueba de comportamiento.
8. **No cargar un segundo mapa WebGL en la portada.** Usar una imagen o vector derivado del sector real. El mapa interactivo completo sigue en `/app/`.
9. **Mantener las fuentes y advertencias cerca de la evidencia.** El descargo completo puede seguir en el pie, pero «Herramienta independiente» y «Alertas sujetas a revisión» deben poder verse junto al plano o al CTA.
10. **Mantener el estilo del mapa base en esta fase.** Ya usa Positron de OpenFreeMap. Cambiar sus fuentes a Barlow requiere comprobar el servicio de glifos del estilo; no basta con cambiar la fuente CSS. No añadir esta dependencia al PR.

## 5. Dirección de diseño acordable

Concepto: **un plano de trabajo catastral contemporáneo**. Debe ser claro para un funcionario y comprensible para un jurado desde el celular. La pieza memorable es la relación entre un sector real y una ficha de revisión.

| Uso | Valor propuesto |
|---|---|
| Papel | `#F2F2F3` |
| Superficie | `#FFFFFF` |
| Tinta principal | `#1D1F20` |
| Texto secundario | `#5D5D60` |
| Marca y acción principal | `#416180` |
| Acento gráfico, sin texto normal blanco encima | `#5980A6` |
| Líneas decorativas | `#D4D4D7` |
| Límites de controles cuando sean necesarios para identificarlos | `#77777B`, verificar en render |

Tipografía: Barlow Condensed para titulares y cifras de presentación; Barlow para párrafos, tablas, filtros y ficha. Cuerpo de landing 16–18 px; evitar condensada en direcciones y número predial. Números tabulares en datos. Línea de lectura alrededor de 65 caracteres, alineada a la izquierda.

Marcos rectos y líneas finas en figuras; controles con radio 2–4 px si mejora su reconocimiento. Sin botones cápsula, halos verdes ni tarjetas flotantes. Sombras solo si un panel superpuesto necesita separarse del mapa. Las líneas decorativas suaves no deben ser el único límite de un control.

Movimiento: eliminar barrido, pulsos, brillo y autoplay. Transiciones cortas al abrir un menú o una ficha; respetar movimiento reducido. El contenido no debe depender de una animación para aparecer.

Marca: wordmark `Suelo-IA` y símbolo SVG propio de una manzana subdividida, dentro de un marco cuadrado abierto. Debe funcionar a 16–24 px y en monocromo. No usar una imagen generada por IA como cartografía, evidencia, logo institucional o fuente de datos.

## 6. Landing propuesta, sección por sección

### A. Encabezado

Marca a la izquierda; «Piloto en Neiva · sector urbano 02» como contexto. Enlaces «Alertas», «Método» y «Fuentes», más «Abrir el mapa». En móvil, menú accesible que no tape el CTA ni duplique una barra fija sobre contenido.

### B. Portada cartográfica

Composición de aproximadamente 40 % texto y 60 % plano en escritorio. En móvil: título, explicación, CTA y después plano. Altura contenida para que el usuario vea evidencia sin recorrer varias pantallas.

**H1:** «Un mapa para orientar la revisión catastral de Neiva.»

**Texto:** «Cruza el registro catastral con huellas de edificaciones y consulta qué predios conviene verificar, con razones, fuentes y fechas.»

**Acción:** «Explorar el sector 02». Enlace secundario: «Ver una ficha de ejemplo».

Plano del sector real con una sola zona destacada, anotación legible y atribuciones. El recorte puede usar un tratamiento azul suave. Si elimina colores de prioridad, rotularlo como vista de contexto sin leyenda de prioridad. La escala o norte solo se incluyen si corresponden a la vista y se recalculan o conservan correctamente al recortar; en caso contrario se omiten. El texto principal permanece en HTML.

Junto al plano: «Piloto del sector 02. Alertas para priorizar revisión; no son hallazgos confirmados. Herramienta independiente, no oficial».

### C. Cuadro del piloto

Franja integrada al marco del plano, sin cuatro tarjetas con sombra: predios dibujados, predios con al menos una alerta, tasa de cruce y fecha de generación. La leyenda A1–A3 lleva sus propios conteos para no confundir totales con categorías.

Datos observados en la revisión: `predios_con_geometria=7329`, `predios_con_alerta=1285`, `tasa_cruce=0.9647`, `alertas={A1:807,A2:414,A3:90}`, `generado=2026-10-22T14:50:44+00:00`. Son valores de referencia para comprobar, **no constantes para copiar a la interfaz**. [Fuente: resumen.json](https://github.com/sjpolaniaoro/suelo-IA/blob/6a31aa5b646b2943c1d5da800bb7b963f55f2ba2/web/public/data/resumen.json).

Distinguir «Registro: vigencia 2025» de «Datos procesados: 22 de octubre de 2026». La vigencia está en el manifiesto; la fecha de proceso está en `generado`. No afirmar actualización en vivo.

### D. Ficha de revisión de ejemplo

Subir la evidencia antes de explicar todo el método. Composición con fragmento del plano y una ficha: registro, huella observada, motivo de alerta, confianza y fuentes. Usar un predio realmente existente en los datos derivados, con enlace `/app/?predio=…`, sin inventar dirección, área, puntaje ni veredicto.

Elegirlo de forma reproducible y documentar su NPN en el PR. El ejemplo no registra decisiones. Si no puede obtenerse una ficha real verificable, mostrar un esquema con etiquetas de campos, identificado como ilustrativo y sin números ficticios. No descargar de Google Maps una imagen como evidencia sin revisar sus condiciones; preferir un recorte del propio mapa con sus atribuciones.

### E. Leyenda de alertas

Tres filas: código, explicación, condición resumida y conteo del JSON. A1: posible construcción no registrada; A2: posible área subregistrada; A3: avalúo atípico. Agregar «Un predio puede tener más de una alerta».

Los umbrales se verifican contra `pipeline/config.yaml` y la especificación. Si se muestran valores, registrar su fuente y revisar su correspondencia en el PR. No duplicar esos umbrales como reglas ejecutables en el frontend ni presentar área de huella y área construida como mediciones equivalentes.

### F. Método y límites

Proceso estático de cinco etapas: fuentes, cruce espacial, alertas, consulta de ficha, revisión humana. En móvil se convierte en lista vertical. Numerar solo este proceso, porque sí tiene secuencia. Explicar que la altura 3D depende de la cartografía y puede ser ilustrativa; no es una medición satelital de altura actual.

Incluir notas breves sobre fechas diferentes entre fuentes, datos faltantes y precisión pendiente de validación. La FAQ actual habla de una muestra menor que el README; evitar fijar tamaños de muestra en el nuevo copy. Decir que la validación está pendiente y enlazar su documentación, sin prometer métricas.

### G. Alcance, preguntas y cajetín

Resumen compacto de lo disponible y lo previsto, sin tarjetas de precios. POT/RAG, serie temporal y ampliación de sectores deben estar claramente señalados como futuros según el estado del repositorio; no agregarlos al producto.

Conservar preguntas útiles sobre fuentes, validación, revisiones locales y ausencia de API. Acordeón accesible, preferiblemente con elementos nativos. Pie tipo cajetín con proyecto, vigencia, fecha de proceso, fuentes, licencias, GitHub y convocatoria. No sugerir aval institucional.

## 7. Mapa: transformación visual limitada

- Panel claro con divisiones y jerarquía tipográfica; conservar dimensiones útiles, desplazamiento y disposición móvil.
- La barra «Detectados / Por revisar / Revisados / Confirmados» sigue siendo un conjunto de filtros con sus conteos y estado seleccionado. Puede parecer una regla técnica, pero no convertirse en una secuencia obligatoria ni cambiar su cálculo.
- Conservar colores y claves de prioridad, veredictos, alturas y transparencia de huellas. Distinguir selección de prioridad y de veredicto mediante borde y rótulo. La marca azul no debe reinterpretarse como un cuarto nivel de alerta.
- Ficha como hoja de revisión: datos comparables, razones y decisión con orden claro. Mantener los botones y todas las teclas C/D/N/S/J/K/Esc.
- Aviso de API con borde y rótulo legible. No ocultarlo por neutralizar su color. «Sin API» no significa que todas las teselas y fuentes externas funcionen sin internet.
- Logo nuevo, controles sobrios y tooltip claro. Conservar control 3D/cenital, recentrado, enlaces de evidencia y atribuciones.
- No modificar `pasaFiltros`, orden de lista, selección por URL, gestión de revisiones, importación/exportación ni las claves `suelo-ia-revisiones` y `suelo-ia-auto`.

## 8. Archivos y alcance técnico

Las rutas existentes se comprobaron en el commit indicado. Los archivos nuevos son propuestas de organización.

| Archivo | Instrucción para el ejecutor |
|---|---|
| `web/index.html` | Nueva estructura y copy; fuentes, favicon, metadatos y navegación coherentes |
| `web/src/landing/landing.css` | Sustituir composición y tema antiguos; estilos acotados a landing |
| `web/src/landing/landing.js` | Retirar radar, maquetas automáticas y perfiles; conservar/adaptar cifras, menú y FAQ; eliminar referencias a nodos borrados |
| Nuevo `web/src/tokens.css` | Fuente única de tokens; separar marca y colores funcionales |
| `web/src/styles.css` | Aplicar identidad al mapa conservando layouts, scroll y estados |
| `web/app/index.html` | Fuente y favicon nuevos, `theme-color` claro |
| `web/src/App.jsx` | Solo marcado, logo, clases y ayudas accesibles necesarias |
| `web/src/Ficha.jsx` | Solo presentación; preservar propiedades, controladores y decisiones |
| `web/src/Mapa.jsx` | Solo tooltip y presentación necesaria; conservar lógica, colores semánticos, base y capas |
| Nuevos `web/public/img/…`, `web/public/favicon.svg` | Plano derivado real y marca propia; sin datos personales añadidos |
| Nuevo `docs/diseno-plano-catastral.md` | Decisiones, fuentes del plano y excepciones verificables |

Importar tokens desde los dos CSS con rutas correctas: `../tokens.css` desde `landing/landing.css` y `./tokens.css` desde `styles.css`. Mantener la carga de fuentes en los HTML o centralizarla deliberadamente, sin duplicar además un `@import` remoto.

Fuera de alcance: `pipeline/`, `api/`, datos de `web/public/data/`, `datos.js`, `revisiones.js`, `vite.config.js`, infraestructura, autenticación, reglas de negocio, dependencias y archivos de bloqueo. No incorporar Tailwind, Next.js, shadcn ni librerías de animación para este cambio. SVG propio basta para iconos y marca.

## 9. Qué tomar de TodoDeIA

De la [guía leída](https://www.tododeia.com/community/11-sitios-diseno-ia) tomo el proceso: escoger referencias, definir el sistema y después resolver componentes. Para Suelo-IA lo traduzco en un documento de diseño breve, dos vistas de referencia del propio producto —sector y ficha— y comprobación de escritorio/móvil.

No adopto su receta genérica de landing ni su kit completo. Este proyecto ya tiene stack y reglas. Las bibliotecas que enumera son opciones de consulta, no dependencias necesarias. Cualquier recurso externo que se use después debe verificarse en su fuente original y tener licencia compatible. No se ha descargado un DESIGN.md de Refero ni elegido una plantilla externa: el sistema propuesto aquí es propio.

La referencia primaria de [frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) refuerza diseñar desde el tema real y limitar decoración y movimiento. La interpretación específica —plano predial y ficha— es una decisión de esta propuesta.

## 10. Comprobaciones exigidas al PR futuro

No se han ejecutado estas pruebas: son condiciones para el modelo que implemente.

- [ ] Vista inicial reconocible como Suelo-IA: plano real, marca propia y copy territorial. Comparación visual con Radar SECOP a la misma anchura.
- [ ] Ausencia del barrido, pulso verde, hero oscuro y carrusel automático antiguos en las dos entradas.
- [ ] Cifras, vigencia y fechas verificadas contra JSON; carga, error y ausencia de JavaScript legibles. Sin ceros falsos ni métricas inventadas.
- [ ] A1/A2/A3 y prioridad se explican por separado. Conteos por alerta no se presentan como suma de predios únicos.
- [ ] Plano y ficha reales y trazables; leyenda coherente; sin cotas ni norte falsos; atribuciones visibles.
- [ ] Capturas a 360, 768 y 1440 px, sin desbordamiento horizontal; repetir con ficha abierta y fuentes externas bloqueadas.
- [ ] Navegación por teclado, menú, FAQ, foco visible y zoom al 200 %. Controles principales de al menos 44 px de alto como meta de usabilidad; el mínimo normativo AA es 24×24 CSS px, con excepciones. [W3C](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- [ ] Contraste de texto normal ≥4,5:1 y de texto grande ≥3:1; comprobar estados hover/focus/disabled y límites de controles. No asumir que Lighthouse verifica toda la accesibilidad. [W3C](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- [ ] `/app/` carga; filtros de prioridad y alerta conservan resultados; lista y selección se corresponden; enlace `?predio=` abre la ficha correcta.
- [ ] 3D/cenital, recentrado y ficha funcionan en escritorio/móvil. Revisiones existentes siguen apareciendo y mantienen su significado.
- [ ] C/D/N/S/J/K/Esc y avance automático conservados; importar/exportar CSV y abrir GeoJSON mantienen comportamiento.
- [ ] API inaccesible: frontend usa datos estáticos y conserva aviso. Fallo de teselas no elimina la capacidad de consultar lista/ficha.
- [ ] `npm ci` y `npm run build` en `web/` con Node compatible con CI; comprobar ambas entradas en el build servido y ausencia de errores nuevos de consola.
- [ ] CI existente completa: `ruff check .`, `pytest -q` y build web. No regenerar datos para comprobar un cambio visual.
- [ ] Landing sin cargar deck.gl/MapLibre ni el GeoJSON completo solo para una imagen de portada. Objetivo orientativo: imagen principal ≤250 KB, con dimensiones reservadas y carga prioritaria solo donde corresponda.
- [ ] Lighthouse accesibilidad ≥95 como señal complementaria; registrar informe, dispositivo y limitaciones. No afirmar resultados no ejecutados.
- [ ] Diff final limitado al alcance: sin cambios de API, datos, persistencia o parámetros. Español en interfaz, comentarios y commits según `CLAUDE.md`.

## 11. Texto propuesto para el PR de implementación futuro

**Título:** Rediseña Suelo-IA con una identidad de plano catastral

**Rama sugerida:** `codex/rediseno-plano-catastral`.

**Descripción, para adaptar al resultado implementado:**

> La landing de Suelo-IA comparte con Radar SECOP el tema de radar, varios patrones de interacción y parte de su redacción. Este cambio introduce una identidad de plano catastral: portada basada en el sector real, tipografía Barlow, superficies claras, ficha de revisión y notas técnicas. Reorganiza el contenido para mostrar primero el territorio y la evidencia.
>
> La interfaz del mapa adopta la marca y los estilos nuevos conservando prioridades, estados, filtros, atajos, revisiones locales y exportaciones. El pipeline, la API y los datos no cambian.
>
> Validación: completar con los comandos realmente ejecutados y sus resultados; adjuntar capturas comparables de landing y mapa en escritorio y móvil, ficha abierta y modo sin API. Registrar cualquier comprobación pendiente antes de solicitar revisión.

## 12. Prompt para entregar al otro modelo

Copiar el siguiente bloque y adjuntar este documento completo. La primera etapa sigue siendo de evaluación. Solo el usuario autoriza posteriormente la implementación.

```text
Revisa sjpolaniaoro/suelo-IA y la propuesta adjunta «Plano catastral».

OBJETIVO
Preparar el rediseño de imagen de la landing y de la interfaz del mapa para
diferenciar Suelo-IA de Radar SECOP. El territorio y la ficha de revisión son
los protagonistas. Preserva las funciones y los datos del producto actual.

ETAPA ACTUAL: SOLO PLANIFICAR
No edites código, crees ramas, commits o PRs, instales paquetes ni despliegues.
Lee CLAUDE.md, docs/spec.md y docs/plan-de-tareas.md; comprueba el HEAD actual.
La propuesta se revisó contra 6a31aa5b646b2943c1d5da800bb7b963f55f2ba2:
si el repositorio cambió, identifica las diferencias relevantes.

Entrega un plan final por archivo, un esquema de escritorio y móvil, tokens,
copy principal, riesgos y criterios de aceptación. Explica qué conservarías
y qué ajustarías del documento. No inventes datos, verificaciones ni fuentes.
Detente tras esa entrega y espera una orden explícita de implementación.

CUANDO EL USUARIO AUTORICE IMPLEMENTAR
Trabaja en una rama aislada desde la base verificada, conserva cambios ajenos
y aplica el alcance aprobado. Mantén Vite + React + CSS y el mapa existente.
No cambies pipeline/API, GeoJSON, parámetros, prioridades, claves de datos,
almacenamiento local, filtros, alturas, atajos ni contratos de importación/CSV.
No migres a otro framework ni añadas bibliotecas de diseño o animación.

Sustituye la composición y voz de la landing; no hagas solo un cambio de color.
Usa plano derivado real, marca SVG propia, Barlow y azul acero accesible.
Reserva los colores de prioridad y veredictos para su función en el mapa.
No cargues un mapa WebGL adicional en la landing. Retira las referencias JS
a los nodos y temporizadores eliminados. Centraliza tokens y preserva el modo
sin API. Usa las cifras del JSON con carga/error honestos y fechas diferenciadas.

Ejecuta las comprobaciones del documento y muestra capturas. Entrega diff,
resultados reales, pendientes y descripción final del PR. Crear/publicar el PR,
hacer merge y desplegar requieren que la orden del usuario cubra esas acciones;
este documento de propuesta por sí solo no las autoriza.
```

