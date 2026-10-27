# Base de revisiones (Supabase)

Guarda las decisiones humanas de la mesa de revisión (confirmado, descartado, no concluyente) para que el
equipo las vea, no se pierdan y se puedan auditar. Es un **registro de solo anexar**: cada decisión es una
fila nueva; «quitar» una revisión es otro evento. Nada se actualiza ni se borra.

- Proyecto: `suelo-ia` en Supabase (región São Paulo, plan gratuito).
- Esquema: [`migrations/0001_revisiones.sql`](migrations/0001_revisiones.sql),
  [`migrations/0002_endurecer.sql`](migrations/0002_endurecer.sql) y
  [`migrations/0003_limite_de_intentos.sql`](migrations/0003_limite_de_intentos.sql). Se aplican en ese orden.
- Pruebas de la 0003: [`pruebas/0003_limite_de_intentos.sql`](pruebas/0003_limite_de_intentos.sql). Se corren
  después de aplicar la migración y terminan con un `RAISE EXCEPTION` que revierte todo (la tabla es de solo anexar).

## Límite de intentos del código (migración 0003)
Antes, cada llamada anónima con un código distinto costaba un bcrypt y no había freno. Ahora los fallos se cuentan
por cliente (`cf-connecting-ip`, o el último elemento de `x-forwarded-for`) y en un cubo global:

- 5 fallos de un cliente: bloqueo de 30 s, luego 60 s, 120 s… hasta 1 h. Mientras dura, no se ejecuta `crypt()`.
- 40 fallos entre todos los clientes: bloqueo global de 60 s, 120 s… (respaldo contra muchos orígenes). Es un
  compromiso de disponibilidad: un atacante puede bloquear la sincronización del equipo, pero la mesa sigue
  funcionando con las revisiones locales y no se pierde nada.
- Un acierto limpia el contador del cliente. Un código correcto durante un bloqueo tampoco entra.
- Las funciones ya no lanzan error ante un código malo (un error revertiría el contador): devuelven
  `{ok:false, error:'codigo_invalido'|'demasiados_intentos'}`. El cliente entiende esta forma y la anterior,
  así que se puede desplegar el frontend antes o después de aplicar la migración (primero el frontend es lo más limpio).
- Pendiente de comprobar en producción: que PostgREST entregue `cf-connecting-ip` en `request.headers`. Si no llega,
  todos comparten el cliente `sin-ip` y el límite por cliente se vuelve global.

## Cómo se protege
- Las tablas están cerradas a todos los roles (RLS sin políticas). El navegador no las lee ni las escribe.
- Solo hay dos funciones públicas, `registrar_revision` y `leer_revisiones`, y ambas exigen el **código de
  equipo**. El código se guarda como hash (bcrypt); no está en el repositorio.
- Un disparador impide `update`, `delete` y `truncate`.
- La clave publicable del frontend es pública por diseño: sin el código no da acceso a nada.
- Datos personales: solo el nombre básico de quien revisa (2 a 60 caracteres).

## Operación
Cambiar el código de equipo (en el editor SQL de Supabase):

Usa un código aleatorio de **al menos 16 caracteres** (bcrypt solo considera los primeros 72 bytes):

```sql
do $$ begin
  if length('NUEVO-CODIGO') < 16 then raise exception 'El código debe tener al menos 16 caracteres'; end if;
  update public.equipo_codigo
  set codigo_hash = extensions.crypt('NUEVO-CODIGO', extensions.gen_salt('bf', 10));
end $$;
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
