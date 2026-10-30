import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Mapa, { COLORES, COLORES_ACCION, COLORES_CLASE, COLORES_ESTADO, COLORES_INCONSISTENCIA, COLORES_VERIFICADO_OK, SIN_PRIORIDAD, nivelDe, pasaFiltros } from "./Mapa.jsx";
import { CLASES_SIN_ALERTA, ETIQUETA_CLASE, TEXTO_CLASE, claseSinAlerta, claseSinPrioridad, requiereRevision, tieneAlerta, tipoHallazgo } from "./clases.js";
import Ficha from "./Ficha.jsx";
import Desplegable from "./Desplegable.jsx";
import { UMBRALES, enriquecer } from "./consistencia.js";
import { apiDisponible, cargarSector, fichaDesdeApi, limites } from "./datos.js";
import {
  aCsv, borrarEquipo, desdeCsv, descargar, guardar, guardarCola, guardarEquipo, leer, leerCola, leerEquipo,
} from "./revisiones.js";
import { enviarNube, leerNube, uuid } from "./nube.js";
import { LIMITE_BYTES, validarGeojson } from "./validar.js";

const NIVELES = [["rojo", "Alta"], ["naranja", "Media"], ["amarillo", "Baja"]];
const NIVELES_UI = [...NIVELES, [SIN_PRIORIDAD, "Sin prioridad"]];
// Sin filtros se ve todo el sector: todas las prioridades, incluida «Sin prioridad», y todas sus clases.
const TODOS_NIVELES = new Set(NIVELES_UI.map((x) => x[0]));
const CLASES_TODAS = () => new Set(CLASES_SIN_ALERTA.map((c) => c[0]));
const TIPOS = [["todas", "Todas"], ["A1", "A1 Construcción no registrada"], ["A2", "A2 Área subregistrada"], ["A3", "A3 Avalúo atípico"], ["NR", "NR Revisar destino (uso no residencial)"], ["ninguna", "Ninguna: predios sin alerta"]];
const ACCIONES = [["todas", "Todas"], ["oficina", "Conciliar en oficina"], ["campo", "Verificar en campo"], ["ninguna", "Sin cola"]];
const TRI = { dos_fuentes: "2 fuentes", solo_cartografia: "solo cartografía", solo_imagen: "solo imagen" };
const CONS = [["todas", "Todos"], ["inconsistente", "Registro ≠ cartografía"], ["coincide", "Coinciden"], ["no_aplica", "No aplica (propiedad horizontal)"]];
// Evidencia de las tres fuentes: va en los dos CSV aunque el predio se haya marcado como OK.
const COLUMNAS_EVIDENCIA = [
  ["area_registrada_m2", "area_construida_reg"], ["area_cartografia_m2", "area_cart"], ["area_imagen_m2", "area_huella"],
  ["confianza_imagen", "confianza_media"], ["registro_vs_cartografia", "cons"],
];
const MAX_LISTA = 400;
const ANCHO_FICHA = { min: 320, max: 640, inicial: 400 };

const n = (x) => (x ?? 0).toLocaleString("es-CO");
const rgb = (c) => `rgb(${c.join(",")})`;
const ICONO = { confirmado: "✓", descartado: "✕", no_concluyente: "?" };

const umbralesDe = (resumen) => ({ ...UMBRALES, ...(resumen?.umbrales_consistencia || {}) });

function leerAncho() {
  try {
    const v = Number(localStorage.getItem("suelo-ia-ancho-ficha"));
    return v >= ANCHO_FICHA.min && v <= ANCHO_FICHA.max ? v : ANCHO_FICHA.inicial;
  } catch { return ANCHO_FICHA.inicial; }
}

function leerAuto() {
  try { return localStorage.getItem("suelo-ia-auto") !== "0"; } catch { return true; }
}

export default function App() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [api, setApi] = useState(null); // null = comprobando
  const [tipo, setTipo] = useState("todas");
  const [accion, setAccion] = useState("todas");
  const [cons, setCons] = useState("todas"); // registro vs cartografía
  const [abierto, setAbierto] = useState(null); // desplegable de la barra superior abierto
  const [resaltar, setResaltar] = useState(false); // contorno magenta en los predios con registro ≠ cartografía
  const [anchoFicha, setAnchoFicha] = useState(leerAncho);
  const [niveles, setNiveles] = useState(TODOS_NIVELES);
  const [sinAlerta, setSinAlerta] = useState(CLASES_TODAS); // detalle de «Sin prioridad»; solo actúa con ese botón activo
  const [etapa, setEtapa] = useState("todos"); // todos | pendientes | revisados | confirmado; abre en «Predios»: sin filtros, la lista coincide con el total
  const [sel, setSel] = useState(() => new URLSearchParams(window.location.search).get("predio"));
  const [ficha, setFicha] = useState(null);
  const [revisiones, setRevisiones] = useState(leer);
  const [guardadoOk, setGuardadoOk] = useState(true);
  const [panel, setPanel] = useState(true);
  const [auto, setAuto] = useState(leerAuto);
  const [mostrar, setMostrar] = useState(MAX_LISTA);
  const entrada = useRef(null);

  /* ---------- Revisión en equipo (Supabase): nombre, código y cola de envío ---------- */
  const [equipo, setEquipo] = useState(leerEquipo);
  const [sync, setSync] = useState({ estado: "local", error: "" });
  const [pendientes, setPendientes] = useState(() => leerCola().length);
  const [formEquipo, setFormEquipo] = useState({ nombre: "", codigo: "", error: "", ocupado: false });
  const equipoRef = useRef(equipo);
  const colaRef = useRef(leerCola());
  const enviando = useRef(false);
  const codigoMalo = useRef(false); // con un código rechazado no se reintenta: cada intento cuenta como fallo
  equipoRef.current = equipo;

  const fijarCola = useCallback((nueva) => {
    colaRef.current = nueva;
    guardarCola(nueva);
    setPendientes(nueva.length);
  }, []);

  // Trae lo que el equipo ya revisó y lo une con lo local (lo pendiente de enviar no se pisa).
  const traer = useCallback(async () => {
    const eq = equipoRef.current;
    if (!eq) return;
    const filas = await leerNube(eq.codigo);
    const enNube = new Set(filas.map((f) => f.npn));
    setRevisiones((prev) => {
      const sig = { ...prev };
      for (const f of filas) {
        if (colaRef.current.some((e) => e.npn === f.npn)) continue;
        const local = sig[f.npn];
        if (!local || (local.fecha || "") <= f.fecha_cliente) {
          sig[f.npn] = { estado: f.estado, fecha: f.fecha_cliente, revisor: f.revisor, nube: true };
        }
      }
      // Lo que alguien quitó en la nube y aquí ya estaba sincronizado se retira también.
      for (const [npn, r] of Object.entries(sig)) {
        if (r.nube && !enNube.has(npn) && !colaRef.current.some((e) => e.npn === npn)) delete sig[npn];
      }
      guardar(sig);
      return sig;
    });
  }, []);

  const vaciar = useCallback(async () => {
    const eq = equipoRef.current;
    if (!eq || enviando.current || codigoMalo.current) return;
    enviando.current = true;
    try {
      if (colaRef.current.length) setSync({ estado: "enviando", error: "" });
      // La cola se lee del almacenamiento en cada vuelta: otra pestaña también puede estar agregando o enviando.
      while (true) {
        colaRef.current = leerCola();
        if (!colaRef.current.length) break;
        const ev = colaRef.current[0];
        try {
          await enviarNube(ev, eq.codigo);
        } catch (e) {
          if (e.tipo !== "datos") throw e;
          // Solo un rechazo por los datos descarta el evento para no bloquear a los demás.
        }
        fijarCola(leerCola().filter((x) => x.id !== ev.id));
        if (ev.estado !== "quitada" && !colaRef.current.some((x) => x.npn === ev.npn)) {
          setRevisiones((prev) => (prev[ev.npn] ? { ...prev, [ev.npn]: { ...prev[ev.npn], nube: true } } : prev));
        }
      }
      await traer();
      setSync({ estado: "ok", error: "" });
    } catch (e) {
      if (e.tipo === "codigo") codigoMalo.current = true;
      setSync({ estado: e.tipo === "codigo" ? "codigo" : e.tipo === "bloqueo" ? "bloqueo" : "red", error: e.message });
    } finally {
      enviando.current = false;
    }
  }, [fijarCola, traer]);

  useEffect(() => {
    if (!equipo) return undefined;
    vaciar();
    const cada = setInterval(vaciar, 30000);
    window.addEventListener("online", vaciar);
    return () => {
      clearInterval(cada);
      window.removeEventListener("online", vaciar);
    };
  }, [equipo, vaciar]);

  useEffect(() => {
    cargarSector()
      .then((d) => setDatos({ ...d, predios: enriquecer(d.predios, umbralesDe(d.resumen), !!d.resumen?.evidencia_imagenes) }))
      .catch((e) => setError(e.message));
    apiDisponible().then(setApi);
  }, []);

  /* ---------- Clasificación: predios con alerta, ordenados por prioridad ---------- */
  const alertas = useMemo(() => {
    if (!datos) return [];
    return datos.predios.features
      .map((f) => f.properties)
      .filter((p) => p.puntaje > 0 || p.NR)
      .sort((a, b) => b.puntaje - a.puntaje || (b.area_huella ?? 0) - (a.area_huella ?? 0));
  }, [datos]);

  // Predios sin alerta: van después de los que tienen alerta; se ordenan por área de huella.
  const sinAlertas = useMemo(() => {
    if (!datos) return [];
    return datos.predios.features
      .map((f) => f.properties)
      .filter((p) => !tieneAlerta(p))
      .sort((a, b) => (b.area_huella ?? 0) - (a.area_huella ?? 0));
  }, [datos]);
  const filtros = useMemo(() => ({ tipo, niveles, accion, sinAlerta, cons }), [tipo, niveles, accion, sinAlerta, cons]);
  const base = useMemo(
    () => [...alertas, ...sinAlertas].filter((p) => pasaFiltros(p, filtros)),
    [alertas, sinAlertas, filtros],
  );

  // Cada contador responde «cuántos predios saldrían si eligiera este botón», con los demás filtros como están.
  const cuenta = useMemo(() => {
    const universo = [...alertas, ...sinAlertas];
    const contar = (cambio, extra = () => true) => {
      const f = { ...filtros, ...cambio };
      let c = 0;
      for (const p of universo) if (extra(p) && pasaFiltros(p, f)) c++;
      return c;
    };
    return {
      nivel: Object.fromEntries(NIVELES_UI.map(([k]) => [k, contar({ niveles: new Set([k]) }, (p) => nivelDe(p) === k)])),
      clase: Object.fromEntries(CLASES_SIN_ALERTA.map(([k]) => [k, contar({ niveles: new Set([...filtros.niveles, SIN_PRIORIDAD]), tipo: "todas", sinAlerta: new Set([k]) }, (p) => claseSinPrioridad(p) === k)])),
      tipo: Object.fromEntries(TIPOS.map(([k]) => [k, contar(k === "ninguna" ? { tipo: k, niveles: new Set([...filtros.niveles, SIN_PRIORIDAD]) } : { tipo: k })])),
      accion: Object.fromEntries(ACCIONES.map(([k]) => [k, contar({ accion: k })])),
      cons: Object.fromEntries(CONS.map(([k]) => [k, contar({ cons: k })])),
    };
  }, [alertas, sinAlertas, filtros]);

  /* ---------- Proceso: detectados → por revisar → revisados → confirmados ---------- */
  const etapas = useMemo(() => {
    // «Por revisar» son los predios con alerta (A1 a A3 y NR); los sin alerta solo se revisan como control.
    const conAlerta = base.filter(requiereRevision);
    return {
      todos: base.length,
      requieren: conAlerta.length,
      requierenHechos: conAlerta.filter((p) => revisiones[p.npn]).length,
      pendientes: conAlerta.filter((p) => !revisiones[p.npn]).length,
      revisados: base.filter((p) => revisiones[p.npn]).length,
      confirmado: base.filter((p) => revisiones[p.npn]?.estado === "confirmado").length,
      controles: base.filter((p) => !requiereRevision(p) && revisiones[p.npn]).length,
      vivienda: base.filter((p) => p.puntaje > 0).length,
      nr: base.filter((p) => p.NR).length,
      sinAlerta: base.filter((p) => !requiereRevision(p)).length,
    };
  }, [base, revisiones]);

  const lista = useMemo(() => base.filter((p) => {
    const r = revisiones[p.npn];
    if (etapa === "pendientes") return requiereRevision(p) && !r;
    if (etapa === "revisados") return !!r;
    if (etapa === "confirmado") return r?.estado === "confirmado";
    return true;
  }), [base, revisiones, etapa]);
  const visibles = lista.slice(0, mostrar);
  useEffect(() => setMostrar(MAX_LISTA), [tipo, niveles, accion, etapa, sinAlerta, cons]);

  const progreso = { hechos: etapas.requierenHechos, total: etapas.requieren };
  const posicion = useMemo(() => {
    const i = lista.findIndex((p) => p.npn === sel);
    if (i >= 0) return { texto: `${i + 1} de ${n(lista.length)}`, ok: true };
    return { texto: revisiones[sel] ? "Ya revisado" : "Fuera de la etapa o filtros actuales", ok: lista.length > 0 };
  }, [lista, sel, revisiones]);

  const elegir = useCallback((npn) => setSel(npn), []);

  // Enlace compartible: ?predio=número abre la ficha directamente.
  useEffect(() => {
    const u = new URL(window.location.href);
    if (sel) u.searchParams.set("predio", sel);
    else u.searchParams.delete("predio");
    window.history.replaceState(null, "", u);
  }, [sel]);

  // Índice por número predial: evita recorrer 7 mil predios en cada búsqueda.
  const porNpn = useMemo(
    () => new Map((datos?.predios.features ?? []).map((f) => [f.properties.npn, f.properties])),
    [datos],
  );

  useEffect(() => {
    if (!sel || !datos) return setFicha(null);
    const local = porNpn.get(sel);
    setFicha(local || null);
    // Si la persona cambia de predio antes de que responda la API, esa respuesta se ignora.
    let vigente = true;
    if (api && local) {
      fichaDesdeApi(sel)
        .then((f) => { if (vigente) setFicha(f); })
        .catch(() => { if (vigente) setApi(false); });
    }
    return () => { vigente = false; };
  }, [sel, datos, api, porNpn]);

  const umbrales = useMemo(() => umbralesDe(datos?.resumen), [datos]);
  const centro = useMemo(() => {
    const f = datos?.predios.features.find((x) => x.properties.npn === sel);
    if (!f?.geometry) return null;
    const [[x0, y0], [x1, y1]] = limites({ features: [f] });
    return { lat: (y0 + y1) / 2, lon: (x0 + x1) / 2 };
  }, [datos, sel]);

  /* ---------- Navegación entre predios ---------- */
  const mover = useCallback((d) => {
    if (!lista.length) return;
    const i = lista.findIndex((p) => p.npn === sel);
    const j = i < 0 ? 0 : (i + d + lista.length) % lista.length;
    setSel(lista[j].npn);
  }, [lista, sel]);

  const siguientePendiente = useCallback((desde = sel, rev = revisiones) => {
    const i = base.findIndex((p) => p.npn === desde);
    const orden = [...base.slice(i + 1), ...base.slice(0, i + 1)];
    const sig = orden.find((p) => requiereRevision(p) && !rev[p.npn] && p.npn !== desde);
    if (sig) setSel(sig.npn);
  }, [base, sel, revisiones]);

  /* ---------- Decidir ---------- */
  // Foto de la alerta al revisar: sirve después para medir la precisión por tipo de evidencia.
  const eventoDe = useCallback((npn, estado, fecha) => {
    const p = porNpn.get(npn);
    return {
      id: uuid(),
      npn,
      estado,
      fecha,
      revisor: equipoRef.current.nombre,
      puntaje: p?.puntaje ?? null,
      alertas: ["A1", "A2", "A3", "NR"].filter((k) => p?.[k]).join("+") || null,
      triangulacion: p?.triangulacion ?? null,
      accion: p?.accion ?? null,
      version: datos?.resumen?.generado ?? null,
    };
  }, [datos, porNpn]);

  const encolar = useCallback((ev) => {
    fijarCola([...leerCola(), ev]);
    vaciar();
  }, [fijarCola, vaciar]);

  const decidir = useCallback((npn, estado) => {
    const fecha = new Date().toISOString();
    const sig = { ...revisiones, [npn]: { estado, fecha, ...(equipo ? { revisor: equipo.nombre } : {}) } };
    setRevisiones(sig);
    setGuardadoOk(guardar(sig));
    if (equipo) encolar(eventoDe(npn, estado, fecha));
    if (auto) siguientePendiente(npn, sig);
  }, [revisiones, auto, siguientePendiente, equipo, encolar, eventoDe]);

  const quitar = (npn) => {
    const sig = { ...revisiones };
    delete sig[npn];
    setRevisiones(sig);
    setGuardadoOk(guardar(sig));
    if (equipo) encolar(eventoDe(npn, "quitada", new Date().toISOString()));
  };

  const activarEquipo = async (e) => {
    e.preventDefault();
    const nombre = formEquipo.nombre.trim().replace(/\s+/g, " ");
    const codigo = formEquipo.codigo.trim();
    if (nombre.length < 2) return setFormEquipo((f) => ({ ...f, error: "Escribe tu nombre (al menos 2 letras)." }));
    setFormEquipo((f) => ({ ...f, ocupado: true, error: "" }));
    try {
      await leerNube(codigo); // valida el código antes de guardarlo
      const nuevo = { nombre, codigo };
      guardarEquipo(nuevo);
      equipoRef.current = nuevo;
      codigoMalo.current = false;
      // Lo que ya se revisó solo en este navegador pasa al equipo con el nombre de quien lo activa.
      const previas = Object.entries(revisiones).filter(([, r]) => !r.nube && r.origen !== "csv");
      fijarCola([
        ...leerCola(),
        ...previas.map(([npn, r]) => eventoDe(npn, r.estado, r.fecha || new Date().toISOString())),
      ]);
      setRevisiones((prev) => {
        const sig = Object.fromEntries(Object.entries(prev).map(([k, r]) => [k, r.revisor ? r : { ...r, revisor: nombre }]));
        guardar(sig);
        return sig;
      });
      setFormEquipo({ nombre: "", codigo: "", error: "", ocupado: false });
      setEquipo(nuevo);
    } catch (err) {
      setFormEquipo((f) => ({ ...f, ocupado: false, error: err.message }));
    }
  };

  const salirDelEquipo = () => {
    borrarEquipo();
    equipoRef.current = null;
    codigoMalo.current = false;
    setEquipo(null);
    setSync({ estado: "local", error: "" });
  };

  const cambiarAuto = (v) => {
    setAuto(v);
    try { localStorage.setItem("suelo-ia-auto", v ? "1" : "0"); } catch { /* sin almacenamiento */ }
  };

  /* ---------- Atajos de teclado ---------- */
  useEffect(() => {
    const alTecla = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t.closest?.("input, select, textarea, [contenteditable]")) return;
      const k = e.key.toLowerCase();
      if (k === "escape") return setSel(null);
      if (!sel) return;
      if (k === "j" || k === "arrowdown") { e.preventDefault(); mover(1); }
      else if (k === "k" || k === "arrowup") { e.preventDefault(); mover(-1); }
      else if (k === "s") siguientePendiente();
      else {
        const v = { c: "confirmado", d: "descartado", n: "no_concluyente" }[k];
        if (v) decidir(sel, v);
      }
    };
    window.addEventListener("keydown", alTecla);
    return () => window.removeEventListener("keydown", alTecla);
  }, [sel, mover, siguientePendiente, decidir]);

  /* ---------- Exportar y cargar ---------- */
  const exportarRevisiones = () => {
    const mapa = new Map(datos.predios.features.map((f) => [f.properties.npn, f.properties]));
    const filas = Object.entries(revisiones).map(([npn, r]) => ({ ...(mapa.get(npn) || {}), npn, estado: r.estado, fecha: r.fecha, revisor: r.revisor, tipo_hallazgo: mapa.has(npn) ? tipoHallazgo(mapa.get(npn), r.estado) : "" }));
    descargar("revisiones_suelo_ia.csv", aCsv(filas, [["npn", "npn"], ["estado", "estado"], ["tipo_hallazgo", "tipo_hallazgo"], ["fecha", "fecha"], ["revisor", "revisor"], ["direccion", "direccion"], ["puntaje", "puntaje"], ["triangulacion", "triangulacion"], ...COLUMNAS_EVIDENCIA]));
  };
  const exportarLista = () =>
    descargar("lista_priorizada_suelo_ia.csv", aCsv(lista, [["npn", "npn"], ["direccion", "direccion"], ["puntaje", "puntaje"], ["nivel", "nivel"], ["confianza", "confianza"], ["triangulacion", "triangulacion"], ["accion", "accion"], ["razones", "razones"], ...COLUMNAS_EVIDENCIA]));

  // Carga de archivo en el navegador: nada se envía a ningún servidor.
  const cargarArchivo = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      if (f.size > LIMITE_BYTES) throw new Error("El archivo pesa más de 30 MB.");
      const texto = await f.text();
      if (f.name.toLowerCase().endsWith(".csv")) {
        const r = { ...revisiones, ...desdeCsv(texto) };
        setRevisiones(r);
        setGuardadoOk(guardar(r));
      } else {
        const fc = enriquecer(validarGeojson(JSON.parse(texto)), umbrales, !!datos?.resumen?.evidencia_imagenes);
        setDatos((d) => ({ ...d, predios: fc }));
        setSel(null);
      }
    } catch (err) {
      alert("No se pudo cargar el archivo: " + err.message);
    }
  };

  // «Ninguna» (sin alerta) solo tiene sentido con «Sin prioridad»: elegir una enciende la otra y apagar la otra vuelve a «Todas».
  const elegirTipo = (k) => {
    setTipo(k);
    if (k === "ninguna") setEtapa("todos"); // los predios sin alerta no están en «Por revisar»
    if (k === "ninguna" && !niveles.has(SIN_PRIORIDAD)) setNiveles(new Set([...niveles, SIN_PRIORIDAD]));
  };
  const alternarNivel = (k) => {
    const s = new Set(niveles);
    if (s.has(k)) { s.delete(k); if (k === SIN_PRIORIDAD && tipo === "ninguna") setTipo("todas"); } else s.add(k);
    setNiveles(s.size ? s : TODOS_NIVELES);
  };
  const hayFiltros = tipo !== "todas" || accion !== "todas" || cons !== "todas" || niveles.size !== TODOS_NIVELES.size || [...TODOS_NIVELES].some((k) => !niveles.has(k)) || sinAlerta.size !== CLASES_SIN_ALERTA.length;
  const limpiarFiltros = () => { setTipo("todas"); setAccion("todas"); setCons("todas"); setNiveles(TODOS_NIVELES); setSinAlerta(CLASES_TODAS()); };

  const alternarClase = (k) => {
    const s = new Set(sinAlerta);
    if (s.has(k)) s.delete(k); else s.add(k);
    setSinAlerta(s);
  };

  if (error) {
    return (
      <div className="vacio">
        <h1>Suelo-IA</h1>
        <p>No se encontraron los datos del sector ({error}). Corra el pipeline: <code>python -m pipeline.run</code>.</p>
      </div>
    );
  }
  const r = datos?.resumen;
  const tri = r?.triangulacion;
  const hayEvidencia = r?.evidencia_imagenes;
  const pct = etapas.requieren ? (etapas.requierenHechos / etapas.requieren) * 100 : 0;

  const etiquetaDe = (lista, k) => lista.find((x) => x[0] === k)?.[1] ?? k;
  const valorPrioridad = niveles.size === TODOS_NIVELES.size
    ? "Todas"
    : NIVELES_UI.filter(([k]) => niveles.has(k)).map(([, t]) => t).join(", ");
  const valorTipo = tipo === "todas" ? "Todas" : tipo === "ninguna" ? "Ninguna" : tipo;
  const textoSync = {
    ok: pendientes ? `${pendientes} por enviar` : "Sincronizado con el equipo",
    enviando: "Enviando…",
    red: `Sin conexión: ${pendientes} por enviar. Se reintenta solo.`,
    codigo: "El código ya no es válido. Sal del equipo y vuelve a activarlo.",
    bloqueo: "Demasiados intentos con el código: se reintenta solo en unos minutos.",
    local: "Conectando…",
  }[sync.estado];

  /* ---------- Ancho de la ficha: se arrastra el borde o se usan las flechas ---------- */
  const limiteAncho = (v) => Math.round(Math.min(Math.max(v, ANCHO_FICHA.min), Math.min(ANCHO_FICHA.max, window.innerWidth * 0.5)));
  const guardarAncho = (v) => { try { localStorage.setItem("suelo-ia-ancho-ficha", String(v)); } catch { /* sin almacenamiento */ } };
  const arrastrarAsa = (e) => {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = anchoFicha;
    let ultimo = w0;
    const mover = (ev) => { ultimo = limiteAncho(w0 + (x0 - ev.clientX)); setAnchoFicha(ultimo); };
    const soltar = () => {
      window.removeEventListener("pointermove", mover);
      window.removeEventListener("pointerup", soltar);
      guardarAncho(ultimo);
    };
    window.addEventListener("pointermove", mover);
    window.addEventListener("pointerup", soltar);
  };
  const teclaAsa = (e) => {
    const d = e.key === "ArrowLeft" ? 24 : e.key === "ArrowRight" ? -24 : 0;
    if (!d) return;
    e.preventDefault();
    const v = limiteAncho(anchoFicha + d);
    setAnchoFicha(v);
    guardarAncho(v);
  };

  return (
    <div className={`app ${sel ? "con-ficha" : ""}`} style={{ "--ancho-ficha": `${anchoFicha}px` }}>
      <div className="franja" aria-hidden="true"><i /><i /><i /></div>

      <header className="barra-sup">
        <div className="barra-fila">
          <a className="marca" href="/" aria-label="Suelo-IA, volver al inicio">
            <img src="/favicon.svg" width="32" height="32" alt="" className="marca-logo" />
            <span className="palabra">Suelo<i>·</i>IA</span>
          </a>
          <span className="sector">Sector catastral 02 · Neiva</span>
          <div className="barra-acciones">
            <Desplegable id="equipo" etiqueta="Equipo" valor={equipo ? equipo.nombre : undefined} activo={!!equipo} insignia={equipo && pendientes ? pendientes : undefined} abierto={abierto} onAbrir={setAbierto} alineado="der">
              <div className="equipo">
                {!equipo ? (
                  <form onSubmit={activarEquipo}>
                    <p>
                      Guarda las revisiones en la nube para que el equipo las vea y no se pierdan. Se guarda <b>tu nombre</b>{" "}
                      junto a cada revisión; no se guardan documentos, correos ni teléfonos.
                    </p>
                    <label>Tu nombre
                      <input value={formEquipo.nombre} onChange={(e) => setFormEquipo({ ...formEquipo, nombre: e.target.value })} minLength={2} maxLength={60} autoComplete="name" required />
                    </label>
                    <label>Código de equipo
                      <input type="password" value={formEquipo.codigo} onChange={(e) => setFormEquipo({ ...formEquipo, codigo: e.target.value })} autoComplete="off" required />
                    </label>
                    {formEquipo.error && <p className="error-equipo" role="alert">{formEquipo.error}</p>}
                    <button type="submit" disabled={formEquipo.ocupado}>{formEquipo.ocupado ? "Comprobando…" : "Activar"}</button>
                    <p className="suave">Sin el código, las revisiones quedan solo en este navegador.</p>
                  </form>
                ) : (
                  <div>
                    <p className={`estado-sync ${sync.estado}`} role="status">{textoSync}</p>
                    <div className="acciones">
                      <button onClick={vaciar}>Sincronizar ahora</button>
                      <button onClick={salirDelEquipo}>Salir del equipo</button>
                    </div>
                  </div>
                )}
              </div>
            </Desplegable>

            <Desplegable id="archivo" etiqueta="Exportar y créditos" abierto={abierto} onAbrir={setAbierto} alineado="der">
              <div className="archivo">
                <div className="acciones">
                  <button onClick={exportarLista} disabled={!lista.length}>Exportar lista</button>
                  <button onClick={exportarRevisiones} disabled={!Object.keys(revisiones).length}>Exportar revisiones</button>
                  <button onClick={() => entrada.current.click()}>Cargar…</button>
                </div>
                <p className="suave">Los CSV incluyen las áreas de registro, cartografía e imagen y la confianza, también de los predios marcados OK.</p>
                <small>
                  Registro 1 y cartografía (Alcaldía de Neiva, vigencia 2025); Open Buildings (Google Research, CC BY 4.0 / ODbL);
                  mapa base © OpenStreetMap. Salidas indicativas, sujetas a revisión humana.
                </small>
              </div>
            </Desplegable>
            <input ref={entrada} type="file" accept=".geojson,.json,.csv" hidden onChange={cargarArchivo} />
            <a className="inicio" href="/">← Inicio</a>
          </div>
        </div>

        <div className="barra-filtros" role="group" aria-label="Filtros">
          <span className="filtros-rotulo">Filtrar</span>

          <Desplegable id="prioridad" etiqueta="Prioridad" valor={valorPrioridad} activo={niveles.size !== TODOS_NIVELES.size} abierto={abierto} onAbrir={setAbierto}>
            <p className="desp-nota">Elige una o varias.</p>
            <div className="opciones" role="group" aria-label="Prioridad">
              {NIVELES_UI.map(([k, t]) => (
                <button key={k} className={niveles.has(k) ? "on" : ""} role="checkbox" aria-checked={niveles.has(k)} onClick={() => alternarNivel(k)}
                  title={k === SIN_PRIORIDAD ? "Predios sin puntaje: sin alerta, o NR (uso no residencial). Solo con el tipo «Todas»" : undefined}>
                  <i className="marca-casilla" style={{ "--c": k === SIN_PRIORIDAD ? rgb(COLORES.sin_alerta) : rgb(COLORES[k]) }} /><span>{t}</span><b>{n(cuenta.nivel[k])}</b>
                </button>
              ))}
            </div>
            {niveles.has(SIN_PRIORIDAD) && (
              <div className="sub-filtro" role="group" aria-label="Detalle de sin prioridad">
                <p className="desp-nota">Qué incluye «Sin prioridad»</p>
                <div className="opciones">
                  {CLASES_SIN_ALERTA.map(([k, t, ayuda]) => (
                    <button key={k} className={sinAlerta.has(k) ? "on" : ""} role="checkbox" aria-checked={sinAlerta.has(k)} onClick={() => alternarClase(k)} title={ayuda}>
                      <i className="marca-casilla" style={{ "--c": rgb(COLORES_CLASE[k]) }} /><span>{t}</span><b>{n(cuenta.clase[k])}</b>
                    </button>
                  ))}
                </div>
                {tipo !== "todas" && tipo !== "ninguna" && <p className="suave">Con un tipo de alerta elegido no hay predios sin prioridad: no tienen tipo. Elija «Todas» o «Ninguna».</p>}
              </div>
            )}
          </Desplegable>

          <Desplegable id="tipo" etiqueta="Tipo de alerta" valor={valorTipo} activo={tipo !== "todas"} abierto={abierto} onAbrir={setAbierto}>
            <div className="opciones" role="radiogroup" aria-label="Tipo de alerta">
              {TIPOS.map(([k, t]) => (
                <button key={k} className={tipo === k ? "on" : ""} role="radio" aria-checked={tipo === k} onClick={() => { elegirTipo(k); setAbierto(null); }}>
                  <i className="marca-radio" /><span>{t}</span><b>{n(cuenta.tipo[k])}</b>
                </button>
              ))}
            </div>
          </Desplegable>

          <Desplegable id="cola" etiqueta="Cola de trabajo" valor={etiquetaDe(ACCIONES, accion)} activo={accion !== "todas"} abierto={abierto} onAbrir={setAbierto}>
            <div className="opciones" role="radiogroup" aria-label="Cola de trabajo">
              {ACCIONES.map(([k, t]) => (
                <button key={k} className={accion === k ? "on" : ""} role="radio" aria-checked={accion === k} onClick={() => { setAccion(k); setAbierto(null); }}>
                  <i className="marca-radio" /><span>{t}</span><b>{n(cuenta.accion[k])}</b>
                </button>
              ))}
            </div>
            {tri && (
              <p className="resumen-tri">
                De {n(tri.universo_sin_area)} predios habitacionales sin área construida registrada: en {n(tri.dos_fuentes)} la
                cartografía y la imagen coinciden en contradecir el registro, en {n(tri.solo_cartografia)} solo la cartografía,
                en {n(tri.solo_imagen)} solo la imagen y en {n(tri.sin_evidencia)} ninguna fuente (probable lote vacío).
              </p>
            )}
          </Desplegable>

          <Desplegable id="cons" etiqueta="Registro vs cartografía" valor={etiquetaDe(CONS, cons)} activo={cons !== "todas"} abierto={abierto} onAbrir={setAbierto}>
            <div className="opciones" role="radiogroup" aria-label="Registro frente a cartografía">
              {CONS.map(([k, t]) => (
                <button key={k} className={cons === k ? "on" : ""} role="radio" aria-checked={cons === k} onClick={() => { setCons(k); setAbierto(null); }}>
                  <i className="marca-radio" /><span>{t}</span><b>{n(cuenta.cons[k])}</b>
                </button>
              ))}
            </div>
            <p className="resumen-tri">
              Inconsistente: el área construida del registro y la dibujada en la cartografía difieren más de {Math.round((umbrales.factor_area - 1) * 100)} %
              y más de {n(umbrales.cartografia_min_m2)} m². La ficha de cada predio muestra el detalle.
            </p>
          </Desplegable>

          <Desplegable id="leyenda" etiqueta="Leyenda" abierto={abierto} onAbrir={setAbierto}>
            <div className="leyenda" aria-label="Colores del mapa">
              <span><i style={{ background: rgb(COLORES_ESTADO.confirmado) }} />Confirmado</span>
              <span><i style={{ background: rgb(COLORES_ESTADO.descartado) }} />Descartado</span>
              <span><i style={{ background: rgb(COLORES_ESTADO.no_concluyente) }} />No concluyente</span>
              <span><i style={{ background: rgb(COLORES.no_residencial) }} />Revisar destino (NR)</span>
              <span><i className="borde" style={{ borderColor: rgb(COLORES_ACCION.oficina) }} />Contorno: oficina</span>
              <span><i className="borde" style={{ borderColor: rgb(COLORES_ACCION.campo) }} />Contorno: campo</span>
              <span><i className="borde" style={{ borderColor: rgb(COLORES_INCONSISTENCIA) }} />Contorno ancho: registro ≠ cartografía</span>
              <span><i style={{ background: rgb(COLORES_CLASE.ok) }} />Sin alerta · OK</span>
              <span><i style={{ background: rgb(COLORES_VERIFICADO_OK) }} />Verificado OK (revisado)</span>
              <span><i style={{ background: rgb(COLORES_CLASE.ph) }} />PH sin evaluar</span>
              <span><i style={{ background: rgb(COLORES_CLASE.cartografia) }} />Solo cartografía</span>
              <span><i style={{ background: rgb(COLORES.sin_alerta) }} />Sin alerta (oculto por el filtro)</span>
            </div>
          </Desplegable>

          <div className="filtros-estado" aria-live="polite">
            <span>Mostrando <b>{n(base.length)}</b> de {n(alertas.length + sinAlertas.length)} predios</span>
            {hayFiltros && <button className="enlace" onClick={limpiarFiltros}>Limpiar filtros</button>}
          </div>
        </div>
      </header>

      <div className="cuerpo">
        <button className="menu" onClick={() => setPanel(!panel)} aria-label="Mostrar u ocultar la lista de predios" aria-expanded={panel}>☰</button>

        <section className={`panel ${panel ? "" : "oculto"}`} aria-label="Lista de predios">
          <section className="proceso" aria-label="Proceso de revisión">
            <ol className="etapas">
              {[
                ["todos", "Predios", etapas.todos],
                ["pendientes", "Por revisar", etapas.pendientes],
                ["revisados", "Revisados", etapas.revisados],
                ["confirmado", "Confirmados", etapas.confirmado],
              ].map(([k, t, c], i) => (
                <li key={k}>
                  <button className={etapa === k ? "on" : ""} aria-pressed={etapa === k} onClick={() => setEtapa(k)}>
                    <span className="nodo">{n(c)}</span>
                    <span className="etapa-nombre"><i>{i + 1}</i> {t}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="barra-avance" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(pct)} aria-label="Avance de revisión">
              <i style={{ width: `${pct}%` }} />
            </div>
            <p className="avance-texto" aria-live="polite">
              {n(etapas.requierenHechos)} de {n(etapas.requieren)} predios con alerta revisados
              {etapas.pendientes === 0 && etapas.requieren > 0 ? " · ¡cola completa!" : ""}
            </p>
            <p className="avance-detalle">
              {n(etapas.todos)} predios = {n(etapas.vivienda)} con alerta de vivienda + {n(etapas.nr)} NR (revisar destino) + {n(etapas.sinAlerta)} sin alerta
              {etapas.controles ? ` · ${n(etapas.controles)} ${etapas.controles === 1 ? "control sin alerta revisado" : "controles sin alerta revisados"}` : ""}
            </p>
          </section>

          {r && !hayEvidencia && <p className="aviso">Evidencia de imágenes pendiente: solo se muestra A3.</p>}
          {api === false && <p className="aviso">Modo sin conexión a la API: se usan los datos incluidos en la página.</p>}
          {!guardadoOk && <p className="aviso">El navegador no permite guardar: las revisiones se pierden al cerrar. Exporte el CSV.</p>}

          <ol className="lista" aria-label="Predios de la etapa seleccionada">
            {visibles.map((p) => {
              const rev = revisiones[p.npn];
              const clase = claseSinAlerta(p);
              const tipos = clase ? TEXTO_CLASE[clase] : ["A1", "A2", "A3", "NR"].filter((k) => p[k]).join(" · ");
              const fuentes = p.triangulacion && TRI[p.triangulacion] ? ` · ${TRI[p.triangulacion]}` : "";
              const incons = p.cons === "inconsistente" ? " · reg ≠ cart" : "";
              return (
                <li key={p.npn}>
                  <button className={`${p.npn === sel ? "sel" : ""} n-${clase ? `clase-${clase}` : p.nivel}`} onClick={() => elegir(p.npn)}>
                    <span className="dir">{p.direccion || p.npn}</span>
                    <span className="meta">{tipos}{fuentes}{incons}{p.area_huella ? ` · ${n(Math.round(p.area_huella))} m²` : ""}{p.confianza === "baja" ? " · conf. baja" : ""}</span>
                    <b className="pt">{clase ? ETIQUETA_CLASE[clase] : p.NR ? "NR" : p.puntaje}</b>
                    {rev && <em className={`est ${clase && rev.estado === "descartado" ? "verificado_ok" : rev.estado}`} title={clase && rev.estado === "descartado" ? "verificado OK" : rev.estado}>{clase && rev.estado === "descartado" ? "✓" : ICONO[rev.estado]}</em>}
                  </button>
                </li>
              );
            })}
            {datos && lista.length === 0 && (
              <li className="nada">
                {etapa === "pendientes" && etapas.requieren > 0 ? "No quedan predios con alerta por revisar con estos filtros." : etapa === "pendientes" && etapas.todos > 0 ? "Estos predios no tienen alerta: están en la etapa «Predios»." : "Sin predios en esta etapa."}
              </li>
            )}
            {lista.length > visibles.length && (
              <li><button className="mas" onClick={() => setMostrar(mostrar + MAX_LISTA)}>Mostrar {n(Math.min(MAX_LISTA, lista.length - visibles.length))} más de {n(lista.length - visibles.length)}</button></li>
            )}
          </ol>
        </section>

        <main>
          {!datos && <div className="cargando">Cargando sector…</div>}
          <Mapa predios={datos?.predios} huellas={datos?.huellas} filtros={filtros} estados={revisiones} seleccionado={sel} onSeleccion={elegir} resaltar={resaltar || cons === "inconsistente"} onResaltar={setResaltar} />
        </main>

        {ficha && (
          <div className="ficha-col">
            <div
              className="asa"
              role="separator"
              aria-orientation="vertical"
              aria-label="Cambiar el ancho de la ficha"
              aria-valuemin={ANCHO_FICHA.min}
              aria-valuemax={ANCHO_FICHA.max}
              aria-valuenow={anchoFicha}
              tabIndex={0}
              onPointerDown={arrastrarAsa}
              onKeyDown={teclaAsa}
              onDoubleClick={() => { setAnchoFicha(ANCHO_FICHA.inicial); guardarAncho(ANCHO_FICHA.inicial); }}
              title="Arrastra para cambiar el ancho · doble clic para restablecer"
            />
            <Ficha
              p={ficha}
              revision={revisiones[ficha.npn]}
              onDecidir={decidir}
              onQuitar={quitar}
              onCerrar={() => setSel(null)}
              onSiguiente={() => siguientePendiente()}
              onMover={mover}
              posicion={posicion}
              progreso={progreso}
              centro={centro}
              manifiesto={datos?.manifiesto}
              hayEvidencia={hayEvidencia}
              auto={auto}
              onAuto={cambiarAuto}
              umbrales={umbrales}
            />
          </div>
        )}
      </div>
    </div>
  );
}
