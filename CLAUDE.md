# Suelo-IA: instrucciones para Claude Code

Antes de escribir código, lee `docs/spec.md` (fuente de la verdad) y `docs/plan-de-tareas.md` (orden de trabajo). Si algo del código contradice el spec, el spec manda; si el spec no alcanza, pregunta.

## Reglas
- Idioma: español en README, comentarios, textos de la interfaz y mensajes de commit.
- Alcance: solo lo que está en "Incluye (v1)" del spec. El RAG, el índice de subutilización y el valor por zona no se construyen en v1.
- Datos personales: el pipeline nunca lee ni escribe nombres, cédulas o contactos. Falla con error explícito si aparecen.
- Datos crudos: `data/raw/` está en `.gitignore`. Al repo solo suben datos derivados del sector piloto (`web/public/data/`, `api/data/`).
- Cifras: nunca inventar cifras. Toda cifra que aparezca en la interfaz o el README sale del pipeline. Si un conteo no coincide con el spec, detenerse y reportar.
- Parámetros de alertas: en `pipeline/config.yaml`, no en el código.
- Sistemas de referencia: los shapefiles vienen en EPSG:9377; la web usa EPSG:4326.
- Despliegue: frontend en Vercel desde `web/`; API en Render (plan gratuito) desde `api/`. El frontend debe funcionar sin la API.
