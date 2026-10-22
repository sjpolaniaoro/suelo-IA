# Identidad «Plano catastral»

Suelo-IA presenta el territorio y una ficha real antes de explicar el método. La portada usa superficies claras, azul acero, Barlow/Barlow Condensed y divisiones de plano. Sustituye el barrido de radar, los perfiles por pestañas, las maquetas automáticas y las tarjetas de planes. Las preguntas usan `details` nativos y el menú móvil conserva navegación por teclado y Escape.

## Marca y datos

- `web/src/tokens.css` es la fuente compartida de colores, familias tipográficas y radio de controles.
- Marca: `web/public/favicon.svg`, un marco abierto con parcelas. El mismo archivo se usa en portada, favicon y cabecera del mapa.
- El azul de marca no representa prioridad. El mapa conserva sus colores funcionales y sus claves de prioridad y veredicto. La selección se distingue en la lista con un borde y los filtros muestran texto y estado presionado.
- Texto principal `#1D1F20` sobre papel `#F2F2F3`. Acciones blancas sobre `#416180` (contraste aproximado 6,47:1).
- Cifras y conteos A1–A3 se leen de `resumen.json`. Se muestran carga y fallo explícitos; las alertas pueden solaparse. La vigencia se lee del manifiesto y se separa de la fecha de procesamiento.
- La portada no importa React, MapLibre ni deck.gl, ni descarga el GeoJSON completo. El mapa interactivo se mantiene en `/app/`.

## Cartografía reproducible y ficha de ejemplo

Ejecutar desde `web/`:

```sh
node scripts/generar-plano.mjs
```

El script lee exclusivamente el GeoJSON derivado de `public/data/sector02.geojson`. Genera `public/img/plano-sector02.svg` y `src/landing/ejemplo.json`; no modifica el pipeline ni sus datos. La imagen representa una vista de contexto cenital y no una medición, una escala oficial o una clasificación de prioridad. Se agrupan terrenos por los primeros 21 dígitos del NPN para evitar dibujar repetidamente unidades con el mismo terreno. Se simplifica la ilustración a media unidad de su viewBox y se redondean posiciones de pantalla; las geometrías originales no cambian.

La ficha selecciona el primer NPN en orden léxico entre predios con A1, confianza normal, geometría y terreno menor a 300 m². Es un criterio de selección del ejemplo, no un parámetro de alerta. El ejemplo actual es `410010102000000010004000000000` y enlaza a `/app/?predio=410010102000000010004000000000`. Dirección, áreas y razón provienen del mismo registro. No representa un hallazgo confirmado y no registra decisiones.

`ejemplo.json` incluye el SHA-256 del archivo de origen. Si el pipeline cambia ese GeoJSON, regenerar ambos artefactos juntos y verificar el enlace a la ficha. La atribución de la ilustración corresponde a la cartografía de la Alcaldía de Neiva; no utiliza teselas ni imágenes descargadas de terceros. Las fuentes y licencias continúan en `LICENCIAS.md` y en la interfaz del mapa.

## Alcance de implementación

Los cambios React se limitan al logo, rótulo de ficha y estados accesibles de controles. Se conservan carga estática, API opcional, selección por URL, lista, filtros, alturas, atajos C/D/N/S/J/K/Esc, CSV, importación GeoJSON y claves de almacenamiento local.

La verificación con el estilo remoto inaccesible detectó un fallo de inicialización: deck.gl podía consultar la proyección antes de que MapLibre tuviera un estilo cargado. La instalación del overlay y sus actualizaciones esperan `style.load` y retiran sus suscripciones al desmontar. Este ajuste de ciclo de vida conserva las capas y el comportamiento de revisión, y permite utilizar el fondo de respaldo sin romper la interfaz.

La tipografía del mapa base sigue perteneciendo al estilo Positron; Barlow se aplica a la interfaz y al tooltip. No se cambian el proveedor, las capas ni los glifos del mapa. El modo sin API no equivale a funcionamiento completo sin internet: fuentes, teselas y enlaces de imagen pueden necesitar conexión.

No se incorporan frameworks o dependencias al proyecto, nuevas funciones de IA, otros sectores, usuarios, impuestos ni nuevos avalúos. La ampliación de cobertura y la consulta normativa se presentan como desarrollos futuros.

## Verificación de la implementación

- `npm ci` y `npm run build` en `web/`: correctos.
- `ruff check .`: correcto. `pytest -q`: 13 pruebas correctas.
- Chrome con la compilación de producción: portada a 360, 768 y 1440 px; menú y Escape; FAQ; cifras y ficha contrastadas con los JSON; estados de error del resumen y navegación sin JavaScript.
- Flujo portada → mapa → ficha; vistas 3D/cenital y recentrado; decisiones C/D/N, persistencia tras recarga, exportación e importación de revisiones y filtro A1 con conteo del CSV. Mapa y ficha a 360 px sin desbordamiento horizontal.
- axe con reglas WCAG 2 A/AA, 2.1 AA y 2.2 AA: ninguna infracción automática en la portada y la ficha de escritorio probadas. Esto no sustituye una auditoría manual completa.
- El mapa se verificó también con OpenFreeMap inaccesible y sin API: el fondo de respaldo y los datos estáticos permiten continuar revisando. No se ha medido Lighthouse ni se certifica disponibilidad del proveedor de teselas.
