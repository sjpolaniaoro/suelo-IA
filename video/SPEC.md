# SPEC: Suelo-IA, video comercial (storyline A)

GOAL:    que un jurado o funcionario de Neiva entienda en 90 s que Suelo-IA le dice dónde mirar primero, con evidencia y con una persona decidiendo, y quiera abrir la demo.
OUTPUT:  HyperFrames, 1920 x 1080, 30 fps, MP4 para YouTube.
TIME:    90 s x 30 fps = 2.700 cuadros. Sin música: el reloj son los cortes de escena.
LOOK:    suelo papel #f2f2f3 plano con retícula de plano 64 px en #416180 al 6 %; tinta #1d1f20; texto secundario #5d5d60;
         acento #416180 solo en la marca, el botón de llamada y una palabra por plano;
         rojo #e5484d solo para «0 m²», A1 y prioridad alta (como en la app).
         Titulares Barlow Condensed 700, 88-120 px, tracking -1 %; cifras héroe 220-300 px;
         texto Barlow 500, 34-44 px; nunca menos de 28 px.
         Medio: la interfaz real de Suelo-IA (capturas 2x del build de `web/`) y el mapa 3D real del sector 02
         (cuadros renderizados con deck.gl + MapLibre, fondo de respaldo, sin teselas de terceros).
         Sombras de tarjetas: 0 18px 40px rgba(29,31,32,.14). Sin grano, sin viñeta.
OBJECTS: el mapa 3D del sector 02 (volúmenes grises, predios con alerta en rojo/naranja/amarillo, predio elegido en azul);
         los cuatro archivos fuente con su nombre y tamaño reales (manifiesto.json);
         la ficha del predio K 4 21 115 (registrado 0 m², observado 3.845 m²); el cursor del sistema, negro con borde blanco, 64 px.
MOTION:  llegada expo.out 0.6-0.9 s; cámara power2.inOut 1.0-1.4 s; salidas power3.in 0.3 s;
         resorte de las etiquetas back.out(1.4) en posición, nunca en opacidad;
         palabras con blur 8→0 px, 0.067 s entre palabras; títulos quietos al aterrizar.
SHOTS:
  0-10 s    gancho: órbita real del sector 02 a la derecha; papel a la izquierda con «14.562» ya visible en el cuadro 0;
            «predios urbanos de Neiva / figuran con 0 m² construidos» entra por palabras; fuente Registro 1 2025.
            A los 6 s se reemplaza por «¿Lote vacío o construcción sin registrar?». Whoosh al salir.
  10-21 s   tensión: cuatro archivos reales caen sobre el plano (pop por cada uno); «Las fuentes existen»
            → «pero están separadas» (los archivos se separan); «Verificar exige ir a campo, predio por predio».
  21-28 s   revelación: los archivos vuelan al centro y se funden en el símbolo; «Suelo-IA» letra a letra; impacto.
  28-40 s   prueba 1: la app real completa; cámara al panel de cifras; «7.597 predios del sector 02 · 1.285 con alerta».
  40-51 s   prueba 2: el cursor hace clic en A1 (clic), la app filtra; «807 posibles construcciones no registradas».
  51-66 s   prueba 3: vuelo del sector al predio (video real), corte a la ficha; «Lo registrado frente a lo observado».
  66-75 s   prueba 4: clic en «Confirmado» (clic + chime); la cámara va a los contadores «1 revisado · 1 confirmado».
  75-84 s   recompensa: órbita a pantalla completa; «1.285» cuenta y aterriza (riser + impacto); «predios para mirar primero».
  84-90 s   cierre: «Salida indicativa. Decisión humana.»; marca + URL de la demo + Neiva Fest Reto Innova 2026.
BANNED:  fondo oscuro con objetos flotando; glow, partículas, gradientes morados; tres tarjetas en fila; título sobre captura oscurecida;
         logo pegado en una esquina; maquetas inventadas de la interfaz; cifras que no estén en resumen.json o el Anexo 2;
         decir que la consulta normativa (RAG) ya funciona: no está en la v1.
QA:      t=0 (miniatura con cifra), 4, 15, 25, 34, 45, 58, 70, 80, 88.
