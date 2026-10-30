import { LIMITES } from "./identidad.js";

// Barra de identidad: va en la parte superior, encima de los filtros. Sin identificarse no se registran
// revisiones; con el código de equipo, además, se guardan en la nube con nombre, grupo y contacto.
export default function Identidad({ equipo, formulario, onCambio, onGuardar, onEditar, onSalir, onSincronizar, estado, textoEstado, pendientes, editando, ocupado, error }) {
  const identificado = !!(equipo?.nombre && equipo?.grupo);
  const campo = (nombre, etiqueta, extra = {}) => (
    <label className={`id-${nombre}`}>
      <span>{etiqueta}</span>
      <input
        value={formulario[nombre]}
        onChange={(e) => onCambio({ ...formulario, [nombre]: e.target.value })}
        maxLength={LIMITES[nombre]}
        {...extra}
      />
    </label>
  );

  if (identificado && !editando) {
    return (
      <div className="barra-identidad listo" role="group" aria-label="Quién revisa">
        <span className="id-chip">
          <i className={`id-punto ${equipo.codigo ? estado : "local"}`} aria-hidden="true" />
          <b>{equipo.nombre}</b> · {equipo.grupo}{equipo.contacto ? ` · ${equipo.contacto}` : ""}
        </span>
        <span className={`id-estado ${equipo.codigo ? estado : "local"}`} role="status">
          {equipo.codigo ? textoEstado : "Sin código de equipo: tus revisiones quedan solo en este dispositivo."}
        </span>
        <span className="id-acciones">
          {equipo.codigo && <button type="button" onClick={onSincronizar}>Sincronizar{pendientes ? ` (${pendientes})` : ""}</button>}
          <button type="button" onClick={onEditar}>Editar</button>
          <button type="button" onClick={onSalir}>Salir</button>
        </span>
      </div>
    );
  }

  return (
    <form className="barra-identidad" onSubmit={onGuardar} aria-label="Quién revisa" noValidate>
      {campo("nombre", "Nombre", { autoComplete: "name", required: true, minLength: 2 })}
      {campo("grupo", "Grupo", { autoComplete: "organization", required: true })}
      {campo("contacto", "Correo o teléfono (opcional)", { autoComplete: "email", inputMode: "email" })}
      <label className="id-codigo">
        <span>Código de equipo</span>
        <input type="password" value={formulario.codigo} onChange={(e) => onCambio({ ...formulario, codigo: e.target.value })} autoComplete="off" />
      </label>
      <button type="submit" className="id-guardar" disabled={ocupado}>{ocupado ? "Comprobando…" : "Guardar y empezar"}</button>
      {editando && <button type="button" className="id-cancelar" onClick={onEditar}>Cancelar</button>}
      {error && <p className="id-error" role="alert">{error}</p>}
      <p className="id-nota">
        Se guarda con cada revisión para saber quién la hizo. El contacto es opcional y solo lo ve el equipo. Sin el código
        de equipo, tus revisiones quedan solo en este dispositivo.
      </p>
    </form>
  );
}
