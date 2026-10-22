# Portada y mesa de revisión

La portada presenta el valor del piloto con una captura real del mapa 3D, acceso directo al producto y una solicitud de piloto secundaria. Las marcas de plano quedan limitadas al marco de la captura; la prioridad y los veredictos conservan sus colores funcionales. No se añaden escalas ni flechas de norte que no correspondan a la cámara.

`public/img/sector02-3d.webp` es una captura de `/app/` con los datos incluidos del sector 02, vista 3D y el control «Ver todo el sector». Se ocultaron los paneles y controles para exportar a 1280 × 1050 px. Se utilizó el fondo de respaldo del mapa, sin teselas de terceros. Las atribuciones están en el pie de la imagen en la interfaz. Las alturas son de referencia, según las reglas existentes; no son mediciones nuevas. La captura estática evita descargar el mapa completo en la portada y no necesita reproducción automática. El SVG cenital anterior se conserva como recurso del proyecto.

`scripts/sincronizar-cifras.mjs` se ejecuta antes de cada compilación. Lee `public/data/resumen.json` y actualiza todas las apariciones de `data-stat` en `index.html`; así las cifras son visibles sin JavaScript. En el navegador, `landing.js` vuelve a consultar ese resumen y actualiza también las cifras repetidas o comunica el fallo de carga. Los datos fuente no se modifican.

La franja distingue predios en el mapa, predios con alguna alerta y conteos A1–A3. No presenta A1 como toda la cola de revisión ni suma alertas que pueden solaparse.

El formulario de piloto usa los tres correos indicados por el responsable del proyecto en `data-destino`. Al preparar la solicitud, abre un `mailto:` con los campos codificados y muestra el borrador y un enlace para abrir el correo de nuevo. El visitante debe enviarlo en su aplicación de correo. Hay copia manual si no existe un cliente configurado o se deniega el portapapeles. No se guarda información del formulario ni se envía a un backend. Sin JavaScript se mantiene un enlace directo de correo.
