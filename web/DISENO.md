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

## La portada como pitch (30-oct-2026)
La portada cuenta una historia en este orden: portada (el dolor, con la cifra de la ciudad), `#problema` (el piloto y sus causas), `#solucion`, `#ia`, `#alertas` (cuatro reglas y la triangulación), `#demo` (el ejemplo, clímax), `#impacto`, `#responsable`, `#ruta` (viabilidad y plan fusionados), `#limites`, `#piloto` y un cierre que vuelve a la ficha de ejemplo. Cada cifra aparece en un solo lugar: la de ciudad (`ctx_*`) en la portada, la del sector (`sec_*`) en `#problema`, las alertas y la triangulación en `#alertas`, y los totales de revisión y colas en `#impacto`. Los estilos de las secciones nuevas están en `src/landing/pitch.css`. Toda cifra sale de `resumen.json` con `data-stat`, y las claves deben existir en `landing.js` y en `scripts/sincronizar-cifras.mjs` (lo comprueba `tests/landing.test.mjs`). La barra de triangulación toma sus anchos de `resumen.json` desde `landing.js` y no se muestra sin esos datos; la leyenda conserva las cifras. Los montos del incentivo vienen del Anexo 2 §12 y se rotulan como orientadores; lo previsto (RAG, serie temporal, convenio) se rotula como previsto. El QR de `public/img/qr-demo.svg` abre la ficha del predio de ejemplo (`https://suelo-ia-knwnic.vercel.app/app/?predio=<npn de src/landing/ejemplo.json>`); si cambia el ejemplo o el dominio, regenerarlo (ver «Código QR»). Tiempos y criterios: [`docs/guion-sustentacion.md`](../docs/guion-sustentacion.md).

## Paneles, color y desplazamiento
- Ningún panel de la portada se desplaza en horizontal: se prohíbe `overflow-x: auto|scroll` y `scroll-snap-type` en `src/landing/*.css` (lo comprueba `tests/landing.test.mjs`). Las listas largas se reorganizan en filas o columnas que se apilan en pantallas angostas.
- Tres niveles de panel: **plano** (borde de tinta de 2 px y sombra desplazada: ficha, captura 3D y reglas de `#alertas`), **de apoyo** (superficie y borde `--sia-panel-linea`: capas, pilares, KPI) y **nota** (fondo `--sia-soft` y borde discontinuo: metas y sostenibilidad previstas). La mecánica va en banda oscura (`--neiva-verde-900`).
- Los rellenos de la familia «papel» (`--sia-surface`, `--sia-soft`) no se separan del fondo por luminancia (1,11:1 y 1,13:1 frente a `--sia-paper`); la distinción entre paneles la da el borde. `--sia-panel-linea` (#857c60) llega a 3,69:1 sobre papel y 4,09:1 sobre superficie (WCAG 1.4.11).
- `--sia-rio-texto` (#216a84, 5,39:1 sobre papel) es el azul para texto; `--neiva-rio` (#2b7a96, 4,31:1) queda para líneas y rellenos.
- El amarillo, el rojo y el naranja del mapa significan prioridad; en la portada el amarillo es ornamento (sombras y viñetas) y no codifica estados. Las colas de trabajo se distinguen por el texto y por el estilo del borde (sólido, doble, punteado), no solo por color.
- `tests/contraste.test.mjs` lee `src/tokens.css` y exige estas razones de contraste.

## Código QR de `#demo`
Codifica la URL de la ficha de ejemplo. Se generó sin dependencias del proyecto, con la utilidad `qrcode` ejecutada fuera del repo, y se quitó la cabecera XML para que el archivo empiece en `<svg `:
```sh
npx --yes qrcode -t svg --margin 4 -d '#12342a' -l '#ffffff' -o qr-demo.svg "https://suelo-ia-knwnic.vercel.app/app/?predio=<npn>"
```
Se verificó con un lector (jsQR) a 112, 132, 140, 164 y 620 px. Margen de 4 módulos y 164 px en escritorio (140 px en celular), unos 4 px por módulo. Para proyectarlo en sala conviene abrir `/img/qr-demo.svg` a pantalla completa.

## QR flotante
`#qr-flotante` (`aside` al final de `index.html`, lógica en `iniciarQrFlotante()` de `landing.js`, estilos al final de `pitch.css`) deja el QR a la vista mientras se expone, **sin ningún texto**: las instrucciones se dan de viva voz y el pitch no se tapa con leyendas. Es solo el QR (120 px) con un borde de tinta en la esquina inferior derecha. Un clic en el QR lo amplía (hasta 360 px, para escanear desde lejos) y otro lo reduce; Escape también lo reduce. El botón redondo con un guion lo minimiza a un icono de QR de 44 px (que lo restaura). El estado se recuerda en `sessionStorage`.

Por qué esa esquina: se midió cuántas líneas de texto de la portada tapaba el QR de 120 px en cada esquina, recorriendo la página cada 300 px. Abajo a la izquierda tapa de 3 a 5 veces más texto (4,8–6,4 % de las líneas visibles) que las esquinas de la derecha (0,7–2 %); arriba a la derecha compite con el menú y el botón «Abrir el mapa». Abajo a la derecha tapa 2,0 % a 1280 px, 1,4 % a 1366 px, 0,8 % a 1536 px y casi nada a 1920 px: desde unos 1632 px de ancho cae por completo en el margen de la página.

Solo aparece en pantallas de más de 1000 px, que es la proyección; en el celular ya se está en la herramienta, y se oculta al imprimir. Se oculta también mientras el QR de `#demo` está a la vista, para no repetirlo. Sin JavaScript no se muestra; el QR de `#demo` sigue ahí. El código es el mismo de `public/img/qr-demo.svg`.

## Mapa en celular: vertical y horizontal
`src/pantalla.js` define «pantalla de celular»: `(max-width: 860px), (max-height: 500px) and (orientation: landscape)`. El mismo texto está en `styles.css` y lo comprueba `tests/pantalla.test.mjs`.

- **Vertical:** mapa primero, con barra inferior, tarjeta corta y ficha completa (ver «Decisiones, roles y flujo móvil» más abajo); antes la lista y la ficha eran hojas inferiores de 58 % y 72 %.
- **Horizontal con poca altura (hasta 500 px):** la ficha pasa a un panel lateral (hasta 440 px o 56 % del ancho) y la lista a un cajón a la izquierda; el mapa queda a la vista al lado. La barra superior se compacta.
- **Al girar**, `Mapa.jsx` escucha el cambio de consulta y vuelve a centrar el predio con el relleno nuevo. El relleno de MapLibre se fija siempre en los cuatro lados: MapLibre conserva los que no se nombran y un valor de la orientación anterior se quedaba.
- **Un fallo corregido (30-oct):** el bloque «Cuerpo» (lista | mapa | ficha acoplada) estaba después del bloque móvil y, con la misma especificidad, lo pisaba: en el celular la ficha quedaba como una columna de 400 px fuera de la pantalla. Las reglas de celular de `.cuerpo` y `.ficha-col` van ahora al final de `styles.css`.
- **Para capturas con Playwright**, usar `--use-angle=swiftshader`: con `--use-gl=swiftshader` el lienzo de deck.gl sale en blanco bajo una hoja inferior (es un artefacto del navegador sin GPU, no del CSS).

## Quién revisa: barra de identidad
`Identidad.jsx` es una fila encima de los filtros (reemplaza al desplegable «Equipo»). Sin identificarse muestra el formulario: nombre y grupo (obligatorios), correo o teléfono (opcional, validado) y código de equipo (opcional), con un aviso de uso. Identificada, queda en una línea: nombre · grupo · contacto, estado de sincronización y botones Sincronizar, Editar y Salir. Sin nombre y grupo, los botones de decisión de la ficha están deshabilitados y los atajos C/D/N mueven el foco a la barra. Cada revisión guarda nombre y grupo; con código, también se envía el contacto y la hora de recepción la pone el servidor (`creada_en`). Reglas y operación de la base en `db/README.md`.

## Decisiones, roles y flujo móvil (30-oct)
- **Decisiones explícitas** (`src/decisiones.js`): *Hay error – corregir* (C), *Está OK – sin error* (D), *Evidencia insuficiente* (N) y *No se pudo ubicar* (U), iguales en todos los predios. Debajo del paso «Decidir» va la fuente con error o desactualizada (opcional). Se guardan como los estados de siempre; el motivo de «no concluyente» y la fuente son campos nuevos. Tabla completa de escenarios y su lectura en las métricas: `docs/decisiones-de-revision.md`.
- **Invitado o funcionario** (`Identidad.jsx`, `identidad.js`): el invitado entra con su nombre y envía sin código; el funcionario elige equipo y escribe el código. Los perfiles guardados antes se normalizan (con código: funcionario de `testing`; sin código: invitado). El invitado no lee las revisiones del equipo; un funcionario puede ratificar las de invitados desde la ficha.
- **Celular en vertical: mapa primero.** Mapa casi a pantalla completa con la barra «N por revisar · Ver lista»; la lista abre a pantalla completa («← Ver mapa»); al elegir un predio aparece una **tarjeta corta** (qué se detectó y los cuatro botones) y la ficha completa se abre con «Ver ficha completa» o deslizando hacia arriba; deslizar hacia abajo cierra. Los filtros van tras un botón «Filtros» y el formulario de identidad arranca plegado. En horizontal con poca altura se conserva el panel lateral. El estado vertical lo calcula JavaScript (`useConsulta`) y pone la clase `.vertical` en `.app`, para no repetir la consulta en CSS.

## Enviar el registro (30-oct)
La decisión es un borrador hasta pulsar **Enviar registro** (también Enter): `seleccionActual` y `hayCambio` (`src/decisiones.js`) combinan el borrador con la revisión ya enviada y dicen si hay algo por enviar. Los atajos C, D, N y U solo eligen. Al enviar, `App.jsx` registra, pasa al siguiente predio pendiente y muestra un aviso (`.aviso-envio`); `Ficha.jsx` y `TarjetaMovil.jsx` vuelven arriba (`scrollTo`) cada vez que cambia el predio, para que quien decide no recorra las secciones de nuevo. Los efectos que hacen eso usan cuerpo de bloque: React 19 trata cualquier valor devuelto por un efecto como función de limpieza.
