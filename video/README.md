# Video de presentación de Suelo-IA (90 s)

Video comercial de 90 s en 16:9 para YouTube, hecho con [HyperFrames](https://hyperframes.heygen.com) (HTML renderizado a video). Puede servir como video de respaldo de la sección 6 del Anexo 2.

- Video final: `renders/suelo-ia-90s.mp4` (1920 × 1080, 30 fps).
- Guion y decisiones: `STORYLINES.md` (las tres historias consideradas) y `SPEC.md` (la que se construyó, plano por plano).
- Revisión: `REVIEW.md`.

## Qué muestra y de dónde sale

- Las cifras salen de `web/public/data/resumen.json` (pipeline, generado el 22-10-2026) y de `docs/spec.md`: 14.562 predios urbanos habitacionales no PH con 0 m² construidos en el Registro 1 (vigencia 2025); 7.597 predios en el sector 02; 1.285 con alerta; 807 con A1; 96,5 % de cruce.
- Las pantallas son capturas reales del build de `web/` (`assets/img/`), con los datos incluidos del sector 02.
- Los dos planos del mapa 3D (`assets/video/`) son cuadros renderizados por la propia app (deck.gl + MapLibre) moviendo la cámara cuadro a cuadro, sin teselas de terceros.
- Los nombres y tamaños de los archivos fuente salen de `web/public/data/manifiesto.json`.
- El video no presenta la consulta normativa (RAG) como funcionando: no hace parte de la v1.

## Editar y volver a renderizar

Requiere Node.js 22+ y FFmpeg.

```bash
cd video
npx hyperframes preview          # vista previa editable en el navegador
npx hyperframes check            # validación
npx hyperframes render --quality delivery --output renders/suelo-ia-90s.mp4
```

Los textos están en `compositions/*.html` (una escena por archivo). La URL del cierre es la variable `url` de `index.html`.

## Sonido

- Narración en español con la voz local Kokoro «ef_dora» (`npx hyperframes tts`, sin servicios externos). El guion, con el segundo en que entra cada frase, está en `assets/voz/guion.tsv`; cada frase es un archivo en `assets/voz/`.
- Efectos de sonido de Pixabay (licencia en `assets/sfx/CREDITS.md`).
- Sin música de fondo. Para agregarla, copie un archivo con licencia a `assets/music/` y añada en `index.html`, dentro de `#root`:

```html
<audio id="musica" class="clip" src="assets/music/pista.mp3" data-start="0" data-duration="90" data-track-index="20" data-volume="0.15" data-fade-out="1.5"></audio>
```

- Después de renderizar, el audio del MP4 se normalizó a unos −15 LUFS:

```bash
ffmpeg -i renders/suelo-ia-90s.mp4 -c:v copy -af "loudnorm=I=-15:TP=-1.5:LRA=11" -ar 48000 -c:a aac -b:a 192k salida.mp4
```

Para cambiar una frase: edite `assets/voz/guion.tsv`, regenere el archivo con `npx hyperframes tts "texto" -v ef_dora -l es -s 1.05 -o assets/voz/vNN.wav` (requiere `pip install kokoro-onnx soundfile`) y ajuste `data-start`/`data-duration` de `#voz-vNN` en `index.html`.

## Créditos

Open Buildings (Google Research, CC BY 4.0 u ODbL); Registro 1 y cartografía: Alcaldía de Neiva (datos abiertos). GSAP 3.14.2 incluido en `assets/vendor/`. Fuentes Barlow y Barlow Condensed (SIL Open Font License).
