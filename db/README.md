# Base de revisiones (Supabase)

Guarda las decisiones humanas de la mesa de revisión (confirmado, descartado, no concluyente) para que el
equipo las vea, no se pierdan y se puedan auditar. Es un **registro de solo anexar**: cada decisión es una
fila nueva; «quitar» una revisión es otro evento. Nada se actualiza ni se borra.

- Proyecto: `suelo-ia` en Supabase (región São Paulo, plan gratuito).
- Esquema: [`migrations/0001_revisiones.sql`](migrations/0001_revisiones.sql) y
  [`migrations/0002_endurecer.sql`](migrations/0002_endurecer.sql). Se aplican en ese orden.

## Cómo se protege
- Las tablas están cerradas a todos los roles (RLS sin políticas). El navegador no las lee ni las escribe.
- Solo hay dos funciones públicas, `registrar_revision` y `leer_revisiones`, y ambas exigen el **código de
  equipo**. El código se guarda como hash (bcrypt); no está en el repositorio.
- Un disparador impide `update`, `delete` y `truncate`.
- La clave publicable del frontend es pública por diseño: sin el código no da acceso a nada.
- Datos personales: solo el nombre básico de quien revisa (2 a 60 caracteres).

## Operación
Cambiar el código de equipo (en el editor SQL de Supabase):

```sql
update public.equipo_codigo
set codigo_hash = extensions.crypt('NUEVO-CODIGO', extensions.gen_salt('bf', 10));
```

Exportar todo el historial (editor SQL):

```sql
select * from public.revisiones order by creada_en;
```

Llevar las revisiones a la muestra de validación: en la mesa de revisión, «Exportar revisiones»; luego

```bash
python -m pipeline.validacion volcar revisiones_suelo_ia.csv
python -m pipeline.validacion metricas docs/validacion/muestra.csv
```

## Límites
- El plan gratuito pausa el proyecto tras un tiempo sin actividad; los datos se conservan y se reactiva desde
  el panel de Supabase. Conviene revisarlo antes de la sustentación.
- Quien tenga el código puede escribir revisiones con cualquier nombre: el nombre identifica, no autentica.
- Sin conexión o sin código, la mesa sigue funcionando con las revisiones en el navegador.
