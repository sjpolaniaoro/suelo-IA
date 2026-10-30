# Portada y mesa de revisión

La portada presenta el valor del piloto con una captura real del mapa 3D, acceso directo al producto y una solicitud de piloto secundaria. Las marcas de plano quedan limitadas al marco de la captura; la prioridad y los veredictos conservan sus colores funcionales. No se añaden escalas ni flechas de norte que no correspondan a la cámara.

`public/img/sector02-3d.webp` es una captura de `/app/` con los datos incluidos del sector 02, vista 3D y el control «Ver todo el sector». Se ocultaron los paneles y controles para exportar a 1280 × 1050 px. Se utilizó el fondo de respaldo del mapa, sin teselas de terceros. Las atribuciones están en el pie de la imagen en la interfaz. Las alturas son de referencia, según las reglas existentes; no son mediciones nuevas. La captura estática evita descargar el mapa completo en la portada y no necesita reproducción automática. El SVG cenital anterior se conserva como recurso del proyecto.

`scripts/sincronizar-cifras.mjs` se ejecuta antes de cada compilación. Lee `public/data/resumen.json` y actualiza todas las apariciones de `data-stat` en `index.html`; así las cifras son visibles sin JavaScript. En el navegador, `landing.js` vuelve a consultar ese resumen y actualiza también las cifras repetidas o comunica el fallo de carga. Los datos fuente no se modifican.

La franja distingue predios en el mapa, predios con alguna alerta y conteos A1–A3. No presenta A1 como toda la cola de revisión ni suma alertas que pueden solaparse.

El formulario de piloto usa los tres correos indicados por el responsable del proyecto en `data-destino`. Al preparar la solicitud, abre un `mailto:` con los campos codificados y muestra el borrador y un enlace para abrir el correo de nuevo. El visitante debe enviarlo en su aplicación de correo. Hay copia manual si no existe un cliente configurado o se deniega el portapapeles. No se guarda información del formulario ni se envía a un backend. Sin JavaScript se mantiene un enlace directo de correo.

# Mesa de revisión: barra superior y ficha acoplada

Los filtros (prioridad, tipo de alerta, cola de trabajo y registro vs cartografía), la leyenda, el equipo y «Exportar y créditos» viven en una barra horizontal superior. Cada uno es un desplegable que muestra el valor elegido y abre sus opciones con conteos; solo hay uno abierto a la vez. En pantallas angostas la fila de filtros se desplaza en horizontal y el desplegable se fija a todo el ancho.

La lista de predios queda a la izquierda y la ficha se acopla a la derecha como tercera columna: el mapa cambia de tamaño en lugar de quedar tapado. Su ancho se arrastra desde el borde (o con las flechas del teclado; doble clic lo restablece) y se recuerda en el navegador. En el celular la ficha sigue siendo una hoja inferior.

«Registro vs cartografía» (`src/consistencia.js`) compara el área construida del registro con la de la cartografía en ambos sentidos, con los umbrales de `pipeline/config.yaml` que el pipeline copia a `resumen.json` (`umbrales_consistencia`). Propiedad horizontal queda como «No aplica». La ficha muestra siempre las tres fuentes, la diferencia y el porcentaje de coincidencia de cada par, y la confianza de la imagen, también para predios marcados OK; los CSV exportados incluyen esas columnas.
