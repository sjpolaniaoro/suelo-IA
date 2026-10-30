# Guion de sustentación (30-oct-2026)

La portada (`/`) hace de pitch: se presenta haciendo scroll, en el orden de la Guía de Pitch de la convocatoria. Este documento dice qué sección cubre cada criterio, cuánto tiempo darle y qué verificar antes de entrar. No contiene datos personales.

## Sección, criterio y tiempo
Supuesto: 10 minutos en total. Si incluyen las preguntas, recortar la demo a 1:15 y la solución a 1:15.

| Sección (ancla) | Diapositiva de la Guía | Criterio que cubre | Tiempo |
|---|---|---|---|
| Portada | 1. Portada | Comunicación (Anexo 8) | 0:20 |
| `#problema` | 2. El problema en Neiva | Pertinencia (Anexo 7, 10) | 0:40 |
| `#solucion` | 3. La solución | Innovación y diferenciación (8) | 0:50 |
| `#ia` y `#alertas` | 4. Núcleo de IA | IA y calidad técnica (14) | 0:55 |
| `#demo` y `/app/` | 5. Demostración | Funcionamiento y demo (Anexo 8, 12) | 2:00 |
| `#impacto` | 6. Impacto y métricas | Impacto (12) y evidencias (Anexo 8, 6) | 0:45 |
| `#responsable` | 7. IA responsable y datos | IA responsable (10) | 0:30 |
| `#viabilidad` | 8. Viabilidad y sostenibilidad | Viabilidad (8) y sostenibilidad (8) | 0:30 |
| `#ruta` | 9. Plan de implementación | Plan de implementación (Anexo 8, 4) | 0:45 |
| `#equipo` | 10. Equipo y contacto | Dominio técnico (Anexo 8, 4) | 0:15 |
| `#limites` | — | Respuestas al jurado (Anexo 8, 4) | preguntas |

Total del recorrido: 7:30. Quedan 2:30 de margen y preguntas. La Guía suma 6:00; los 90 s de más van a la demo porque pesa 12 de 30 puntos en la planilla de sustentación.

## Qué decir de lo propio y de lo de terceros
- De terceros: la detección de edificaciones (Google Open Buildings v3). No se entrena ni se ajusta.
- Propio: el cruce con el registro y la cartografía, las reglas A1, A2 y NR, el modelo estadístico de anomalías de avalúo (A3), el puntaje con razones, la ficha y el flujo de revisión.
- No hay red neuronal propia. No decir «modelo propio de visión».
- No hay métrica de precisión: la muestra de 240 predios está pendiente de revisión humana. No citar F1 ni precisión como resultado.

## Lista de chequeo del demo
1. Abrir `https://suelo-ia-knwnic.vercel.app/app/` unos minutos antes. La API de Render (plan gratuito) tarda cerca de 50 s en despertar; el mapa funciona sin ella y lo avisa.
2. Dejar a mano el enlace de la ficha de ejemplo (botón «Abrir esta ficha» de `#demo`).
3. Probar el QR de `#demo` con un celular; si hay un video de respaldo, decir que lo es.
4. Las teselas del mapa base y las imágenes de satélite o Street View necesitan internet.

## Diferencias entre el deck en PDF y el repositorio
La portada sigue al repositorio y a `web/public/data/resumen.json`. Para alinear el deck:

| Deck | Repositorio | Decisión |
|---|---|---|
| «1.285 predios con alerta» | 1.283 con alerta de vivienda + 2 NR | La portada muestra 1.283 y menciona los 2 NR. |
| «15 pruebas activas» | `pytest` corre 26; el README dice 25 | La portada solo dice «integración continua»; actualizar el README y el deck. |
| «Expansión urbana del 35 % requiere actualización catastral a 12 años» | Sin fuente en la spec, el Anexo 2 ni el pipeline | Se omite. El contexto sale del Decreto 892 de 2023 (Anexo 2). |
| «Crecimiento por comunas» | El sector 02 es un sector catastral, no una comuna | Se escribe «sector por sector». |
| Maqueta con «Aprobar», «Descartar», «Visitar terreno» y confianza de 92 % | La interfaz usa confirmado, descartado, no concluyente y confianza normal o baja | La portada usa la captura y la ficha reales. |
| Alerta A1 sin umbrales | A1: huella de 20 m² o más con confianza de 0,70 o más | Los umbrales están en `#alertas`. |
| «SaaS interadministrativo» | El Anexo 2 (§10) habla de servicios sujetos a acuerdo | Se rotula «previsto». |
| Uso del incentivo solo como «Inversión del premio $5M» | Anexo 2 §12: 35 / 25 / 15 / 15 / 10 % | La ruta muestra ese reparto, «orientador, antes de deducciones». |
