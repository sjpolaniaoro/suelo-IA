import { useState } from "react";
import { EQUIPOS, LIMITES, ROLES } from "./identidad.js";

// Barra de identidad: va en la parte superior, encima de los filtros. Sin identificarse no se registran
// revisiones. Hay dos grupos: invitado (nombre; envía sin código) y funcionario (equipo y código del equipo).
// En el celular el formulario arranca plegado para dejar el mapa a la vista.
export default function Identidad({ equipo, formulario, onCambio, onGuardar, onEditar, onSalir, onSincronizar, estado, textoEstado, pendientes, editando, ocupado, error, movil = false }) {
  const [abierta, setAbierta] = useState(false);
  const identificado = !!(equipo?.nombre && equipo?.grupo);
  const esFuncionario = formulario.rol === "funcionario";
  const cambiar = (cambio) => onCambio({ ...formulario, ...cambio });

  if (identificado && !editando) {
    const invitado = equipo.rol === "invitado";
    return (
      <div className="barra-identidad listo" role="group" aria-label="Quién revisa">
        <span className="id-chip">
          <i className={`id-punto ${invitado || equipo.codigo ? estado : "local"}`} aria-hidden="true" />
          <b>{equipo.nombre}</b> · {equipo.grupo}{equipo.contacto ? ` · ${equipo.contacto}` : ""}
        </span>
        <span className={`id-estado ${invitado || equipo.codigo ? estado : "local"}`} role="status">
          {invitado ? `Invitado: ${textoEstado}` : equipo.codigo ? textoEstado : "Sin código de equipo: tus revisiones quedan solo en este dispositivo."}
        </span>
        <span className="id-acciones">
          {(invitado || equipo.codigo) && pendientes > 0 && <button type="button" onClick={onSincronizar}>Enviar ({pendientes})</button>}
          {equipo.codigo && pendientes === 0 && <button type="button" onClick={onSincronizar}>Sincronizar</button>}
          <button type="button" onClick={onEditar}>Editar</button>
          <button type="button" onClick={onSalir}>Salir</button>
        </span>
      </div>
    );
  }

  if (movil && !abierta && !editando) {
    return (
      <div className="barra-identidad plegada">
        <button type="button" className="id-abrir" onClick={() => setAbierta(true)}>Identifícate para decidir ▾</button>
      </div>
    );
  }

  return (
    <form className="barra-identidad" onSubmit={onGuardar} aria-label="Quién revisa" noValidate>
      <div className="id-rol" role="radiogroup" aria-label="Cómo entras">
        {ROLES.map(([k, t]) => (
          <button key={k} type="button" role="radio" aria-checked={formulario.rol === k} className={formulario.rol === k ? "on" : ""} onClick={() => cambiar({ rol: k })}>{t}</button>
        ))}
      </div>
      <label className="id-nombre">
        <span>Nombre</span>
        <input value={formulario.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} maxLength={LIMITES.nombre} autoComplete="name" required minLength={2} />
      </label>
      {esFuncionario && (
        <>
          <label className="id-equipo">
            <span>Equipo</span>
            <select value={formulario.equipo} onChange={(e) => cambiar({ equipo: e.target.value })}>
              <option value="">Elige…</option>
              {EQUIPOS.map((q) => <option key={q} value={q}>{q}</option>)}
            </select>
          </label>
          <label className="id-codigo">
            <span>Código del equipo</span>
            <input type="password" value={formulario.codigo} onChange={(e) => cambiar({ codigo: e.target.value })} autoComplete="off" />
          </label>
          <label className="id-contacto">
            <span>Correo o teléfono (opcional)</span>
            <input value={formulario.contacto} onChange={(e) => cambiar({ contacto: e.target.value })} maxLength={LIMITES.contacto} autoComplete="email" inputMode="email" />
          </label>
        </>
      )}
      <button type="submit" className="id-guardar" disabled={ocupado || !formulario.rol}>{ocupado ? "Comprobando…" : "Guardar y empezar"}</button>
      {(editando || movil) && <button type="button" className="id-cancelar" onClick={() => { setAbierta(false); if (editando) onEditar(); }}>Cancelar</button>}
      {error && <p className="id-error" role="alert">{error}</p>}
      <p className="id-nota">
        {!formulario.rol && "Elige cómo entras. "}
        {formulario.rol === "invitado" && "Como invitado envías tus revisiones sin código. Quedan marcadas como «invitado» y cuentan en las métricas solo si un funcionario las ratifica. No ves las revisiones del equipo. "}
        {esFuncionario && "Como funcionario entras con el código de tu equipo: envías y ves las revisiones del equipo. El contacto solo lo ve el equipo. "}
        El nombre se guarda con cada revisión.
      </p>
    </form>
  );
}
