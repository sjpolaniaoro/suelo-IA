# Guion de sustentación (30-oct-2026)

La portada (`/`) hace de pitch: se presenta haciendo scroll. Sigue un hilo narrativo (dolor, causa, idea, mecánica, ejemplo, impacto, confianza, camino y llamado) que cubre las diapositivas de la Guía de Pitch de la convocatoria, con el ejemplo (`#demo`) como clímax tras la mecánica. Este documento dice qué sección cubre cada criterio, cuánto tiempo darle y qué verificar antes de entrar. No contiene datos personales.

## Sección, criterio y tiempo
Supuesto: 10 minutos en total. Si incluyen las preguntas, recortar la demo a 1:15 y la ruta a 0:30.

| Sección (ancla) | Diapositiva de la Guía | Criterio que cubre | Tiempo |
|---|---|---|---|
| Portada (el dolor: 14.562 predios sin área construida) | 1. Portada | Comunicación (Anexo 8) | 0:30 |
| `#problema` (escala del piloto y causas) | 2. El problema en Neiva | Pertinencia (Anexo 7, 10) | 0:40 |
| `#solucion` | 3. La solución | Innovación y diferenciación (8) | 0:40 |
| `#ia` y `#alertas` (capas, cuatro reglas y triangulación) | 4. Núcleo de IA | IA y calidad técnica (14) | 1:00 |
| `#demo` y `/app/` | 5. Demostración | Funcionamiento y demo (Anexo 8, 12) | 2:00 |
| `#impacto` | 6. Impacto y métricas | Impacto (12) y evidencias (Anexo 8, 6) | 0:45 |
| `#responsable` | 7. IA responsable y datos | IA responsable (10) | 0:30 |
| `#ruta` (viabilidad y plan, fusionados) | 8. Viabilidad y sostenibilidad; 9. Plan de implementación | Viabilidad (8), sostenibilidad (8) y plan de implementación (Anexo 8, 4) | 0:50 |
| `#limites` | — | Respuestas al jurado, dominio técnico (Anexo 8, 4) | preguntas |
| `#piloto` y cierre | — | Llamado: solicitud de piloto y vuelta a la ficha de ejemplo | — |

Equipo y contacto (diapositiva 10) no está en esta portada: lo cubre la sección «Socios» del sitio corporativo de Knwbic.

Total del recorrido: 7:15. Quedan 2:45 de margen y preguntas. La Guía suma 6:00; los 90 s de más van a la demo porque pesa 12 de 30 puntos en la planilla de sustentación. La demo queda en el centro del recorrido, no al final, para que no se recorte si el tiempo se acorta.

## Qué decir de lo propio y de lo de terceros
- De terceros: la detección de edificaciones (Google Open Buildings v3). No se entrena ni se ajusta.
- Propio: el cruce con el registro y la cartografía, las reglas A1, A2 y NR, el modelo estadístico de anomalías de avalúo (A3), el puntaje con razones, la ficha y el flujo de revisión.
- No hay red neuronal propia. No decir «modelo propio de visión».
- No hay métrica de precisión: la muestra de 240 predios está pendiente de revisión humana. No citar F1 ni precisión como resultado.

## Lista de chequeo del demo
1. Abrir `https://suelo-ia-knwnic.vercel.app/app/` unos minutos antes. La API de Render (plan gratuito) tarda cerca de 50 s en despertar; el mapa funciona sin ella y lo avisa.
2. Dejar a mano el enlace de la ficha de ejemplo (botón «Abrir esta ficha» de `#demo`).
3. Probar el QR de `#demo` con un celular: abre la ficha del predio de ejemplo, no el mapa vacío. Para proyectarlo, abrir `/img/qr-demo.svg` a pantalla completa o ampliar el navegador. Si hay un video de respaldo, decir que lo es. En pantallas de más de 1000 px el QR queda flotante abajo a la derecha durante toda la exposición, sin texto: dar la instrucción de viva voz. Un clic en el QR lo amplía para escanearlo desde lejos y otro lo reduce; el botón redondo lo minimiza.
4. Las teselas del mapa base y las imágenes de satélite o Street View necesitan internet.

## Antes de que el público pruebe la herramienta
1. Aplicar la migración `db/migrations/0005_grupo_y_contacto.sql` en el editor SQL de Supabase (si no, las revisiones se guardan con el grupo dentro del nombre y sin contacto) y confirmar que el proyecto de Supabase no está pausado.
2. Dar el código de equipo de viva voz: sin él, las revisiones quedan solo en el celular de cada persona. No ponerlo en pantalla ni en el QR (la portada es pública).
3. Decir qué se pide en la barra superior: nombre y grupo (obligatorios) y, si quieren, correo o teléfono. Sin identificarse no se registra nada.
4. Se pueden recibir revisiones repetidas del mismo predio, por varias personas o por la misma: no se deduplica; cada intento queda con su hora de recepción (`creada_en`).
5. Probar el QR en un celular en vertical y en horizontal.

## Diferencias entre el deck en PDF y el repositorio
La portada sigue al repositorio y a `web/public/data/resumen.json`. Para alinear el deck:

| Deck | Repositorio | Decisión |
|---|---|---|
| «1.285 predios con alerta» | 1.283 con alerta de vivienda + 2 NR | La portada muestra 1.283 y menciona los 2 NR. |
| «15 pruebas activas» | Son las 15 pruebas de la web (`npm test` antes de la portada nueva); `pytest` corre otras 26 | La portada solo dice «integración continua». Si se cita un número, decir «26 de Python y 15 de la web» (la portada nueva suma 9 web). |
| «Expansión urbana del 35 % requiere actualización catastral a 12 años» | Sin fuente en la spec, el Anexo 2 ni el pipeline | Se omite. El contexto sale del Decreto 892 de 2023 (Anexo 2). |
| «Crecimiento por comunas» | El sector 02 es un sector catastral, no una comuna | Se escribe «sector por sector». |
| Maqueta con «Aprobar», «Descartar», «Visitar terreno» y confianza de 92 % | La interfaz usa confirmado, descartado, no concluyente y confianza normal o baja | La portada usa la captura y la ficha reales. |
| Alerta A1 sin umbrales | A1: huella de 20 m² o más con confianza de 0,70 o más | Los umbrales están en `#alertas`. |
| «SaaS interadministrativo» | El Anexo 2 (§10) habla de servicios sujetos a acuerdo | Se rotula «previsto». |
| Uso del incentivo solo como «Inversión del premio $5M» | Anexo 2 §12: 35 / 25 / 15 / 15 / 10 % | La ruta muestra ese reparto, «orientador, antes de deducciones». |
