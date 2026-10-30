# Decisiones de revisión: opciones y escenarios

Aprobado el 30-oct-2026. Una persona revisa un predio con imagen o visita y elige una de cuatro decisiones, siempre las mismas. Cómo se lee cada una en las métricas depende de lo que dijo el sistema.

## Las cuatro decisiones

| Botón | Atajo | Se guarda como | Significa |
|---|---|---|---|
| Hay error – corregir | C | `confirmado` | El registro no coincide con lo construido. |
| Está OK – sin error | D | `descartado` | El registro coincide con lo construido. |
| Evidencia insuficiente | N | `no_concluyente`, motivo `insuficiente` | Se pudo mirar, pero no alcanza para decidir. |
| No se pudo ubicar | U | `no_concluyente`, motivo `no_ubicado` | No se ubicó el predio o no hubo acceso. |

**Elegir no es registrar.** Pulsar una decisión (o su atajo) y elegir la fuente solo arma un borrador. La revisión se registra al pulsar **Enviar registro** (atajo Enter); con una revisión ya enviada el botón dice «Enviar cambio» y solo se habilita si algo cambió. Al enviar, la ficha pasa al siguiente predio sin revisar (si «Pasar al siguiente al enviar» está activo), **vuelve arriba** y un aviso confirma qué se envió. La lista, el avance y el CSV solo cuentan lo enviado.

**Fuente con error o desactualizada** (opcional, en toda decisión): `registro`, `cartografia`, `imagen` o `ninguna` («todas coinciden»). Con «Hay error» dice cuál fuente falla; con «Está OK», si todas coinciden o alguna está desactualizada.

## Escenarios (predios del sector 02)

| # | Escenario | Predios | Hay error | Está OK |
|---|---|---|---|---|
| E1 | A1, dos fuentes (oficina) | 732 | acierto | falso positivo |
| E2 | A1, solo imagen (campo) | 73 | acierto | falso positivo |
| E3 | A2, solo imagen (campo) | 347 | acierto | falso positivo |
| E4 | A2, dos fuentes (oficina) | 41 | acierto | falso positivo |
| E5 | A3 sola (avalúo atípico) | 64 | acierto | falso positivo |
| E6 | A2 + A3 | 26 | acierto | falso positivo (un solo veredicto para ambas) |
| E7 | NR (uso no residencial) | 2 | acierto | falso positivo |
| E8 | Sin alerta | 4.108 | omisión | conforme |
| E9 | Sin alerta, sin evidencia (lote vacío) | 101 | omisión | conforme |
| E10 | Sin alerta de imagen, solo cartografía (oficina) | 152 | **acierto** (cuenta como alerta del sistema) | **falso positivo** |
| E11 | Propiedad horizontal sin alerta | 1.683 | **fuera de las métricas** | **fuera de las métricas** |
| E12 | Cualquier escenario, «Evidencia insuficiente» o «No se pudo ubicar» | – | fuera de las tasas; se cuentan aparte por motivo | |
| E13 | Cambiar de opinión | – | la última decisión (por `fecha_cliente`) es la vigente; el historial queda | |

Qué cambió respecto de la versión anterior: E10 antes contaba como omisión del sistema aunque estaba en cola; E11 antes contaba como omisión aunque el sistema no evalúa propiedad horizontal; «no concluyente» mezclaba dos motivos; los textos «Hay diferencia» y «Verificado OK» (solo sin alerta) pasaron a «Hay error» y «Está OK» para todos.

Esta lectura vive en `tipoHallazgo` (`web/src/clases.js`). La muestra de validación (`pipeline/validacion.py`) ya excluye propiedad horizontal del control; sigue tratando `solo_cartografia` según su estrato actual, sin cambios en esta versión.

## Quién decide: invitado y funcionario
- **Funcionario** (código de su equipo): sus decisiones cuentan, salvo las del equipo `testing`, que es de prueba y queda fuera de las métricas.
- **Invitado** (sin código): sus decisiones se guardan y se envían, pero **no cuentan** en las métricas oficiales hasta que un funcionario de un equipo real las ratifique desde la ficha.
- La vista `revisiones_validas` de la base entrega lo que cuenta.
