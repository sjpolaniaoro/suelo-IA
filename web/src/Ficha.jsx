import { useEffect, useRef, useState } from "react";
import { TEXTO_CLASE, claseSinAlerta, tieneAlerta } from "./clases.js";
import { UMBRALES, evaluar, m2 } from "./consistencia.js";
import { DECISIONES, FUENTES, decisionActiva, etiquetaDecision, etiquetaFuente } from "./decisiones.js";

const fmt = (n, u = "") =>
  n === null || n === undefined ? "dato faltante" : `${Number(n).toLocaleString("es-CO", { maximumFractionDigits: 0 })}${u}`;

export const ACCION = { oficina: "Conciliar en oficina", campo: "Verificar en campo" };
const SENTIDO = {
  cartografia_mayor: "La cartografía dibuja más que el registro",
  registro_mayor: "El registro declara más que la cartografía",
  igual: "Registro y cartografía iguales",
};
const signo = (x) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${m2(Math.abs(x))}`;
export const NIVEL = { rojo: "Prioridad alta", naranja: "Prioridad media", amarillo: "Prioridad baja", no_residencial: "Revisar destino", sin_alerta: "Sin alerta" };

export default function Ficha({
  p, revision, onElegir, onEnviar, seleccion = {}, hayCambio = false, onQuitar, onCerrar, onSiguiente, onMover, posicion, progreso, puedeDecidir = true,
  centro, manifiesto, hayEvidencia, auto, onAuto, umbrales = UMBRALES, puedeRatificar = false, onRatificar, onMinimizar, onFuente,
}) {
  const satelite = centro && `https://www.google.com/maps/@${centro.lat.toFixed(6)},${centro.lon.toFixed(6)},19z/data=!3m1!1e3`;
  const calle = centro && `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${centro.lat.toFixed(6)},${centro.lon.toFixed(6)}`;
  const embebidoSatelite = centro && `https://www.google.com/maps?q=${centro.lat.toFixed(6)},${centro.lon.toFixed(6)}&z=19&t=k&output=embed`;
  // Street View solo se incrusta con la API oficial Maps Embed (gratuita, clave restringida por dominio en
  // VITE_GOOGLE_MAPS_KEY). Sin clave, la pestaña «Calle» abre Google Maps en otra pestaña.
  const claveMapas = import.meta.env?.VITE_GOOGLE_MAPS_KEY;
  const embebidoCalle = centro && claveMapas
    && `https://www.google.com/maps/embed/v1/streetview?key=${encodeURIComponent(claveMapas)}&location=${centro.lat.toFixed(6)},${centro.lon.toFixed(6)}&fov=90`;
  const [vista, setVista] = useState(null);
  const [interactivo, setInteractivo] = useState(false);
  const copiar =() => navigator.clipboard?.writeText(window.location.href).catch(() => {});

  const clase = claseSinAlerta(p);
  // La fuente con error (opcional) se elige antes de decidir; si ya hay decisión, cambiarla la vuelve a registrar.
  const activa = decisionActiva(seleccion);
  const fuente = seleccion.fuente ?? null;
  // Al cambiar de predio la ficha vuelve arriba: quien envía no debe recorrer las secciones de nuevo para decidir.
  const raiz = useRef(null);
  useEffect(() => {
    raiz.current?.scrollTo({ top: 0 });
  }, [p.npn]);
  const reg = p.area_construida_reg ?? 0;
  const obs = p.area_huella ?? 0;
  const cart = p.area_cart ?? 0;
  const escala = Math.max(reg, obs, cart, 1);
  const verBarras = !p.ph;
  const hecho = !!revision;
  // Los datos de las tres fuentes se muestran siempre, también tras marcar el predio como OK:
  // que el terreno no confirme la alerta no borra la inconsistencia entre registro, cartografía e imagen.
  const ev = evaluar(p, umbrales, hayEvidencia);
  const incons = ev.estado === "inconsistente";

  return (
    <aside ref={raiz} className={`ficha nivel-${p.nivel}`} aria-label="Ficha del predio">
      <header className="ficha-cab">
        <div className="ficha-nav">
          <button onClick={() => onMover(-1)} disabled={!posicion?.ok} aria-label="Predio anterior" title="Anterior (K)">‹</button>
          <span>{posicion?.texto}</span>
          <button onClick={() => onMover(1)} disabled={!posicion?.ok} aria-label="Predio siguiente" title="Siguiente (J)">›</button>
          {onMinimizar && <button className="minimizar" onClick={onMinimizar} aria-label="Volver a la tarjeta corta" title="Tarjeta corta">▾</button>}
          <button className="cerrar" onClick={onCerrar} aria-label="Cerrar ficha" title="Cerrar (Esc)">×</button>
        </div>
        <p className="ficha-rotulo">Hoja de revisión predial</p>
        <h2>{p.direccion || "Sin dirección"}</h2>
        <p className="npn">{p.npn}</p>
        <div className="chips">
          <span className={`chip-nivel ${p.nivel}`}>{clase ? TEXTO_CLASE[clase] : <>{NIVEL[p.nivel]}{p.NR ? " · sin puntaje de vivienda" : ` · ${fmt(p.puntaje)}`}</>}</span>
          <span className={`chip ${p.confianza === "baja" ? "baja" : ""}`}>Confianza {p.confianza}</span>
          {p.ph && <span className="chip">Propiedad horizontal</span>}
          {p.accion && <span className={`chip chip-accion ${p.accion}`}>{ACCION[p.accion]}</span>}
          {ev.pares?.regCart.discrepa && <span className="chip chip-cons">Registro ≠ cartografía</span>}
          {["A1", "A2", "A3", "NR"].filter((k) => p[k]).map((k) => <span key={k} className="chip chip-alerta">{k}</span>)}
        </div>
      </header>

      <ol className="ficha-pasos">
        <li>
          <div className="paso-cab"><span className="paso-num">1</span><h3>Qué se detectó</h3></div>
          {p.razones?.length ? <ul className="razones">{p.razones.map((r) => <li key={r}>{r}</li>)}</ul> : <p className="suave">Sin alertas.</p>}
          {p.NR && (
            <p className="aviso-destino">
              Uso probablemente no residencial: el registro dice Habitacional sin área construida, pero la huella detectada
              es muy grande para una vivienda. Verifique el uso real y, si corresponde, el destino y el área construida.
              No cuenta en el puntaje de vivienda.
            </p>
          )}
          {hecho && (incons || tieneAlerta(p)) && (
            <p className="aviso-revisado">
              Marcado «{etiquetaDecision(revision)}»: la revisión no borra los datos. Abajo siguen las tres
              fuentes, la diferencia y los porcentajes de coincidencia, aunque el terreno no levante esta alerta.
            </p>
          )}
          <section className="contraste" aria-label="Contraste de fuentes">
            <h4>Contraste de fuentes</h4>
            {ev.diagnostico && (
              <div className={`diagnostico ${ev.diagnostico.nivel}`}>
                <b>{ev.diagnostico.titulo}</b>
                <p>{ev.diagnostico.detalle}</p>
              </div>
            )}
            {verBarras ? (
              <div className="barras">
                <div className="barra"><span>Registrado</span><i className="reg" style={{ width: `${Math.max(2, (reg / escala) * 100)}%` }} /><b>{fmt(reg, " m²")}</b></div>
                <div className="barra"><span>Cartografía</span><i className="cart" style={{ width: `${Math.max(2, (cart / escala) * 100)}%` }} /><b>{fmt(cart, " m²")}</b></div>
                {hayEvidencia
                  ? <div className="barra"><span>Imagen</span><i className="obs" style={{ width: `${Math.max(2, (obs / escala) * 100)}%` }} /><b>{fmt(obs, " m²")}</b></div>
                  : <p className="suave">Evidencia de imágenes pendiente.</p>}
              </div>
            ) : (
              <>
                <p className="suave">El área de propiedad horizontal se registra por unidad: no se compara con la cartografía.</p>
                <dl className="datos">
                  <dt>Registrado</dt><dd>{fmt(reg, " m²")}</dd>
                  <dt>Cartografía</dt><dd>{fmt(cart, " m²")}</dd>
                  {hayEvidencia && <><dt>Imagen</dt><dd>{fmt(obs, " m²")}</dd></>}
                </dl>
              </>
            )}
            {ev.pares && (
              <table className="pares">
                <caption className="solo-lector">Comparación entre pares de fuentes</caption>
                <thead><tr><th scope="col">Par</th><th scope="col">Diferencia</th><th scope="col">Coinciden</th><th scope="col">Resultado</th></tr></thead>
                <tbody>
                  <tr className={ev.pares.regCart.discrepa ? "mal" : "bien"}>
                    <th scope="row">Registro ↔ cartografía</th>
                    <td>{signo(ev.pares.regCart.diff)}</td>
                    <td>{ev.pares.regCart.conc} %</td>
                    <td>{ev.pares.regCart.discrepa ? SENTIDO[ev.pares.regCart.sentido] : "Coinciden"}</td>
                  </tr>
                  {ev.pares.regImg && (
                    <tr className={ev.pares.regImg.discrepa ? "mal" : "bien"}>
                      <th scope="row">Registro ↔ imagen</th>
                      <td>{signo(ev.pares.regImg.diff)}</td>
                      <td>{ev.pares.regImg.conc} %</td>
                      <td>{ev.pares.regImg.discrepa ? "La imagen contradice el registro" : "No contradice"}</td>
                    </tr>
                  )}
                  {ev.pares.cartImg && (
                    <tr className={p.triangulacion && !ev.pares.cartImg.coinciden ? "mal" : "bien"}>
                      <th scope="row">Cartografía ↔ imagen</th>
                      <td>{signo(ev.pares.cartImg.diff)}</td>
                      <td>{ev.pares.cartImg.conc} %</td>
                      <td>{ev.pares.cartImg.coinciden ? "Coinciden entre sí" : p.triangulacion === "solo_cartografia" || p.triangulacion === "solo_imagen" ? "Una no respalda a la otra" : "Sin contradicción"}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
            {ev.confianzaImagen !== null && (
              <dl className="datos exactitud">
                <dt>Confianza de la imagen</dt><dd>{ev.confianzaImagen} %{ev.nHuellas ? ` · ${fmt(ev.nHuellas)} ${ev.nHuellas === 1 ? "huella" : "huellas"}` : ""}</dd>
                {ev.pares && <><dt>Coincidencia registro–cartografía</dt><dd>{ev.pares.regCart.conc} %</dd></>}
              </dl>
            )}
          </section>
          <dl className="datos">
            <dt>Destino</dt><dd>{p.destino}</dd>
            <dt>Terreno</dt><dd>{fmt(p.area_terreno, " m²")}</dd>
            <dt>Avalúo</dt><dd>{p.avaluo ? "$ " + fmt(p.avaluo) : "dato faltante"}</dd>
            <dt>Pisos</dt><dd>{p.pisos_usados ? fmt(p.pisos_usados) : "sin construcción registrada"}{p.altura_ilustrativa ? " (ilustrativa)" : ""}</dd>
          </dl>
        </li>

        <li>
          <div className="paso-cab"><span className="paso-num">2</span><h3>Verificar en imagen</h3></div>
          {centro ? (
            <>
              <div className="vista-tabs" role="tablist" aria-label="Vista de verificación">
                <button role="tab" aria-selected={vista === "satelite"} className={vista === "satelite" ? "activo" : ""} onClick={() => setVista(vista === "satelite" ? null : "satelite")}>Satélite</button>
                {embebidoCalle
                  ? <button role="tab" aria-selected={vista === "calle"} className={vista === "calle" ? "activo" : ""} onClick={() => setVista(vista === "calle" ? null : "calle")}>Calle</button>
                  : <a className="tab-enlace" href={calle} target="_blank" rel="noopener noreferrer">Calle ↗</a>}
              </div>
              {vista && (
                // Mientras el cursor no esté sobre la vista, una capa deja pasar la rueda y las teclas a la
                // ficha (el marco se tragaría el desplazamiento y los atajos C/D/N/J/K).
                <div className="vista-marco" onMouseLeave={() => {
                  setInteractivo(false);
                  if (document.activeElement?.tagName === "IFRAME") document.activeElement.blur();
                }}>
                  <iframe
                    key={`${vista}-${p.npn}`}
                    className="vista-embebida"
                    title={vista === "calle" ? "Vista de calle del predio" : "Imagen satelital del predio"}
                    src={vista === "calle" ? embebidoCalle : embebidoSatelite}
                    referrerPolicy="no-referrer"
                    allowFullScreen
                  />
                  {!interactivo && (
                    <button className="vista-capa" onClick={() => setInteractivo(true)} aria-label="Activar la vista para moverla">
                      <span>Clic para mover el mapa</span>
                    </button>
                  )}
                </div>
              )}
              <div className="enlaces">
                <a href={vista === "calle" ? calle : satelite} target="_blank" rel="noopener noreferrer">Abrir en pestaña ↗</a>
                <button onClick={copiar}>Copiar enlace</button>
              </div>
              {vista && <p className="suave">Si la vista no carga, ábrala en una pestaña nueva.</p>}
            </>
          ) : <p className="suave">Este predio no tiene geometría para ubicarlo.</p>}
        </li>

        <li className={hecho ? "hecho" : ""}>
          <div className="paso-cab"><span className="paso-num">{hecho ? "✓" : "3"}</span><h3>Decidir</h3></div>
          <div className="fuente-error" role="radiogroup" aria-label="Fuente con error o desactualizada">
            <span className="fuente-rotulo">Fuente con error o desactualizada <em>(opcional)</em></span>
            {FUENTES.map(([k, t]) => (
              <button key={k} type="button" role="radio" aria-checked={fuente === k} className={fuente === k ? "on" : ""} disabled={!puedeDecidir} onClick={() => onFuente(k)}>{t}</button>
            ))}
          </div>
          <div className="veredictos">
            {DECISIONES.map((d) => (
              <button key={`${d.k}-${d.motivo ?? ""}`} className={`${d.k} ${activa === d ? "activo" : ""}`} aria-pressed={activa === d} disabled={!puedeDecidir}
                onClick={() => onElegir({ estado: d.k, motivo: d.motivo ?? null })} title={d.ayuda}>
                {d.t}<kbd>{d.tecla}</kbd>
              </button>
            ))}
          </div>
          <button type="button" className="enviar-registro" disabled={!puedeDecidir || !hayCambio} onClick={onEnviar}>
            {revision && !hayCambio ? "Registro enviado ✓" : revision ? "Enviar cambio" : "Enviar registro"}
            {hayCambio && <kbd>Enter</kbd>}
          </button>
          {puedeDecidir && !seleccion.estado && <p className="nota">Elige una decisión; el registro se envía con el botón.</p>}
          {!puedeDecidir && (
            <p className="nota aviso-id" role="note">Para registrar la revisión, identifícate antes en la barra de arriba (invitado o funcionario).</p>
          )}
          {revision && (
            <p className="nota">
              Marcado «{etiquetaDecision(revision)}»{revision.fuente ? ` · fuente: ${etiquetaFuente(revision.fuente)}` : ""} el {revision.fecha.slice(0, 10)}{revision.revisor ? ` por ${revision.revisor}${revision.grupo ? ` (${revision.grupo})` : ""}` : ""}.{" "}
              <button className="enlace" onClick={() => onQuitar(p.npn)}>Quitar</button>
              {revision.rol === "invitado" && (revision.ratificada
                ? <span className="ratificada"> · ratificada por un funcionario</span>
                : puedeRatificar && revision.id && <>{" · "}<button className="enlace" onClick={() => onRatificar(p.npn)}>Ratificar decisión de invitado</button></>)}
            </p>
          )}
        </li>
      </ol>

      <footer className="ficha-pie">
        {progreso?.total > 0 && (
          <button className="siguiente" onClick={onSiguiente} disabled={progreso.hechos >= progreso.total}>
            Siguiente sin revisar <span>→</span>
            <small>{progreso.hechos} de {progreso.total} revisados</small>
          </button>
        )}
        <label className="auto"><input type="checkbox" checked={auto} onChange={(e) => onAuto(e.target.checked)} /> Pasar al siguiente al enviar</label>
        <p className="atajos">Atajos: <kbd>C</kbd> hay error · <kbd>D</kbd> está OK · <kbd>N</kbd> evidencia insuficiente · <kbd>U</kbd> no se pudo ubicar · <kbd>Enter</kbd> enviar · <kbd>S</kbd> siguiente sin revisar · <kbd>J</kbd>/<kbd>K</kbd> mover · <kbd>Esc</kbd> cerrar</p>
        <details className="fuentes">
          <summary>Fuentes y fechas</summary>
          <ul>
            <li>Registro 1 catastral, vigencia {p.vigencia} (Alcaldía de Neiva).</li>
            <li>Cartografía predial (Alcaldía de Neiva), EPSG:9377 reproyectado a EPSG:4326.</li>
            <li>Open Buildings v3 (Google Research), CC BY 4.0 / ODbL{hayEvidencia ? "" : " — no cargado"}.</li>
            {manifiesto?.generado && <li>Datos generados el {manifiesto.generado.slice(0, 10)}.</li>}
          </ul>
        </details>
        <p className="aviso">Salida indicativa: prioriza qué verificar. No modifica avalúos ni genera cobros.</p>
      </footer>
    </aside>
  );
}
