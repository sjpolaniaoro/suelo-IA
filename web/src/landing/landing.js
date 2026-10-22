import "./landing.css";

const BASE = import.meta.env.BASE_URL;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const nf = (n) => Number(n).toLocaleString("es-CO");
const pct = (a, b) => `${(100 * a / b).toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Cifras: salen de resumen.json (generado por el pipeline) ---------- */
async function cifras() {
  try {
    const r = await (await fetch(BASE + "data/resumen.json")).json();
    const c = r.contexto_urbano;
    const v = {
      predios_con_geometria: nf(r.predios_con_geometria),
      predios_con_alerta: nf(r.predios_con_alerta),
      pct_cruce: `${(r.tasa_cruce * 100).toLocaleString("es-CO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`,
      fecha: r.generado.slice(0, 10),
      ctx_sin_area: c ? nf(c.sin_area_construida) : null,
      ctx_hab: c ? nf(c.habitacionales_no_ph) : null,
      ctx_pct: c ? pct(c.sin_area_construida, c.habitacionales_no_ph) : null,
      sec_sin_area: nf(r.sin_area_construida),
      sec_hab: nf(r.habitacionales_no_ph),
      sec_pct: pct(r.sin_area_construida, r.habitacionales_no_ph),
    };
    $$("[data-k]").forEach((el) => {
      const val = v[el.dataset.k];
      if (val) el.textContent = val;
    });
    $("#contador-vivo").hidden = false;
  } catch {
    /* sin datos, la landing igual se lee: quedan los guiones */
  }
}

/* ---------- Navegación ---------- */
const nav = $("#nav");
const alScroll = () => nav.classList.toggle("solida", window.scrollY > 24);
alScroll();
window.addEventListener("scroll", alScroll, { passive: true });
$("#nav-toggle").addEventListener("click", () => {
  const abierta = nav.classList.toggle("abierta");
  $("#nav-toggle").setAttribute("aria-expanded", String(abierta));
});
$$("#nav-menu a").forEach((a) => a.addEventListener("click", () => {
  nav.classList.remove("abierta");
  $("#nav-toggle").setAttribute("aria-expanded", "false");
}));

/* ---------- Aparición al desplazarse ---------- */
const io = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
}), { threshold: 0.12 });
$$(".aparecer").forEach((el) => (reducido ? el.classList.add("visible") : io.observe(el)));

/* ---------- Hero: sector con barrido ---------- */
function azar(semilla) {
  let s = semilla;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}
const NIVELES = [
  { color: "#E5484D", texto: "Alta prioridad", detalle: "Huella detectada de 84 m², sin área construida registrada" },
  { color: "#F48C06", texto: "Prioridad media", detalle: "Huella de 96 m² frente a 40 m² construidos registrados" },
  { color: "#FACC15", texto: "Prioridad baja", detalle: "Avalúo atípico frente a predios similares de la manzana" },
];
function radar() {
  const g = $("#radar-predios");
  const rnd = azar(42);
  const paso = 25;
  let html = "";
  for (let i = 0; i < 16; i++) {
    for (let j = 0; j < 16; j++) {
      if (i % 5 === 4 || j % 5 === 4) continue; // calles
      const x = 8 + i * paso, y = 8 + j * paso;
      const cx = x + paso / 2, cy = y + paso / 2;
      const dx = cx - 200, dy = cy - 200;
      if (Math.hypot(dx, dy) > 186) continue;
      const w = 15 + rnd() * 6, h = 15 + rnd() * 6;
      const rx = x + (paso - w) / 2, ry = y + (paso - h) / 2;
      if (rnd() < 0.09) {
        const n = rnd() < 0.55 ? 0 : rnd() < 0.7 ? 1 : 2;
        const ang = (((Math.atan2(dx, -dy) * 180) / Math.PI) + 360) % 360;
        const retraso = ((ang / 360) * 6).toFixed(2);
        html += `<g class="rp" data-n="${n}" data-cx="${cx}" data-cy="${cy}" style="--retraso:${retraso}s;color:${NIVELES[n].color}">
          <rect class="rp-halo" x="${rx - 3}" y="${ry - 3}" width="${w + 6}" height="${h + 6}" rx="2"/>
          <rect class="rp-nucleo" x="${rx}" y="${ry}" width="${w}" height="${h}" rx="2" fill="${NIVELES[n].color}"/></g>`;
      } else {
        html += `<rect x="${rx}" y="${ry}" width="${w}" height="${h}" rx="2" fill="#2A4156" opacity="${(0.55 + rnd() * 0.3).toFixed(2)}"/>`;
      }
    }
  }
  g.innerHTML = html;

  const tip = $("#radar-tooltip");
  const caja = $(".hero-radar");
  $$(".rp", g).forEach((el) => {
    el.addEventListener("mouseenter", () => {
      const n = NIVELES[+el.dataset.n];
      tip.innerHTML = `<strong>${n.texto} · ejemplo</strong><span>${n.detalle}</span>`;
      const svg = $("#radar-svg").getBoundingClientRect();
      const k = svg.width / 400;
      tip.style.left = `${(svg.left - caja.getBoundingClientRect().left) + +el.dataset.cx * k}px`;
      tip.style.top = `${(svg.top - caja.getBoundingClientRect().top) + +el.dataset.cy * k}px`;
      tip.hidden = false;
    });
    el.addEventListener("mouseleave", () => { tip.hidden = true; });
  });
}
radar();

/* ---------- Flujo en cinco pasos ---------- */
function bloques3d() {
  const alturas = [[1, 1, 2, 1, 1], [2, 1, 1, 3, 1], [1, 2, 1, 1, 2], [1, 1, 3, 1, 1], [2, 1, 1, 2, 1]];
  const marcas = { "1,3": "#E5484D", "3,2": "#F48C06", "0,2": "#FACC15", "4,0": "#E5484D" };
  const w = 26, ox = 170, oy = 30, cubos = [];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    const h = alturas[y][x] * 14;
    const px = (x - y) * w + ox, py = ((x + y) * w) / 2 + oy;
    const c = marcas[`${y},${x}`];
    const tapa = c || "#C9D3DC", izq = c ? "#00000026" : "#9FB0BF", der = c ? "#00000040" : "#B3C1CD";
    cubos.push({ z: x + y, svg: `<g>
      <polygon points="${px},${py - h} ${px + w},${py - h + w / 2} ${px},${py - h + w} ${px - w},${py - h + w / 2}" fill="${tapa}"/>
      <polygon points="${px - w},${py - h + w / 2} ${px},${py - h + w} ${px},${py + w} ${px - w},${py + w / 2}" fill="${c || "#9FB0BF"}"/>
      <polygon points="${px - w},${py - h + w / 2} ${px},${py - h + w} ${px},${py + w} ${px - w},${py + w / 2}" fill="${izq}"/>
      <polygon points="${px + w},${py - h + w / 2} ${px},${py - h + w} ${px},${py + w} ${px + w},${py + w / 2}" fill="${c || "#B3C1CD"}"/>
      <polygon points="${px + w},${py - h + w / 2} ${px},${py - h + w} ${px},${py + w} ${px + w},${py + w / 2}" fill="${der}"/></g>` });
  }
  cubos.sort((a, b) => a.z - b.z);
  return `<svg viewBox="0 0 340 250" role="img" aria-label="Ilustración de bloques en 3D con predios marcados">${cubos.map((c) => c.svg).join("")}</svg>`;
}

const PASOS = [
  {
    nombre: "Reúne las fuentes",
    hace: "Descarga y valida las fuentes abiertas de Neiva y deja constancia de cuándo y de dónde salió cada dato.",
    datos: "Registro 1 catastral (vigencia 2025), cartografía predial, huellas de edificaciones Open Buildings.",
    sale: "Datos depurados y un manifiesto con fechas, versiones y licencias.",
    mock: `<div class="mk"><div class="mk-titulo">Fuentes abiertas <span class="mk-chip mk-chip-g">Ilustración</span></div>
      <div class="mk-chips"><span>Registro 1 · 2025</span><span>Cartografía predial</span><span>Open Buildings v3</span><span>OpenStreetMap</span></div>
      <div class="mk-fila"><span>Sin nombres ni documentos</span><b>✓</b></div>
      <div class="mk-fila"><span>Fecha y versión de cada fuente</span><b>✓</b></div>
      <div class="mk-fila"><span>Licencia registrada</span><b>✓</b></div></div>`,
  },
  {
    nombre: "Cruza predio por predio",
    hace: "Une cada predio del registro con su terreno y compara el área construida registrada con lo que se observa desde el espacio.",
    datos: "Número predial, área registrada, huellas dentro del terreno y su confianza.",
    sale: "Por cada predio: lo registrado frente a lo observado.",
    mock: `<div class="mk"><div class="mk-titulo">Predio de ejemplo <span class="mk-chip mk-chip-g">Ilustración</span></div>
      <div class="mk-barra"><span>Registrado</span><i class="reg" style="--v:2%;--i:0"></i><b>0 m²</b></div>
      <div class="mk-barra"><span>Observado</span><i class="obs" style="--v:84%;--i:1"></i><b>84 m²</b></div>
      <p class="mk-nota">Cada huella se asigna solo al terreno que la contiene. Si un dato falta, se marca como faltante, no como cero.</p></div>`,
  },
  {
    nombre: "Prioriza y explica",
    hace: "Aplica tres reglas claras y un puntaje de 0 a 100. Cada predio guarda en palabras por qué quedó en esa posición.",
    datos: "A1 posible construcción no registrada, A2 área subregistrada, A3 avalúo atípico frente a la manzana.",
    sale: "Lista corta ordenada, con razones y nivel de confianza.",
    mock: `<div class="mk"><div class="mk-titulo">Prioridad de revisión <span class="mk-chip mk-chip-g">Ilustración</span></div><div class="mk-lista">
      <div class="mk-tarjeta" style="--i:0"><div class="mk-anillo" style="--p:70;--c:var(--rojo)"><span>70</span></div><div><strong><span class="mk-chip mk-chip-r">A1</span>Construcción no registrada</strong><small>Huella de 84 m², sin área construida registrada.</small></div></div>
      <div class="mk-tarjeta" style="--i:1"><div class="mk-anillo" style="--p:40;--c:var(--ambar)"><span>40</span></div><div><strong><span class="mk-chip mk-chip-a">A2</span>Área subregistrada</strong><small>Huella de 96 m² frente a 40 m² registrados.</small></div></div>
      <div class="mk-tarjeta" style="--i:2"><div class="mk-anillo" style="--p:10;--c:#C9A100"><span>10</span></div><div><strong><span class="mk-chip mk-chip-g">A3</span>Avalúo atípico</strong><small>Más del doble de lo esperado en su manzana.</small></div></div></div></div>`,
  },
  {
    nombre: "Míralo en 3D",
    hace: "Dibuja el sector en un mapa 3D: la altura sale de los pisos de la cartografía y el color, del puntaje de prioridad.",
    datos: "Pisos por terreno, puntaje y huellas sin construcción registrada.",
    sale: "Un mapa que se gira, se filtra por alerta y se abre desde el celular.",
    mock: `<div class="mk mk-3d"><div class="mk-titulo">Sector en 3D <span class="mk-chip mk-chip-g">Ilustración</span></div>${bloques3d()}</div>`,
  },
  {
    nombre: "Verifica y decide",
    hace: "Abre la ficha, contrasta con imagen satelital o Street View, marca tu veredicto y avanza al siguiente predio.",
    datos: "Ficha con fuentes y fechas, enlaces a Google Maps y cola de revisión.",
    sale: "Revisiones guardadas en tu navegador y exportables a CSV para armar la ruta de visitas.",
    mock: `<div class="mk"><div class="mk-titulo">Verificar en imagen <span class="mk-chip mk-chip-g">Ilustración</span></div>
      <div class="mk-enlaces"><span>Satélite ↗</span><span>Street View ↗</span><span>Copiar enlace</span></div>
      <div class="mk-botones"><span class="on">Confirmado</span><span>Descartado</span><span>No concluyente</span></div>
      <div class="mk-prog">Siguiente sin revisar → <span>12 de 70 revisados</span></div></div>`,
  },
];

const lista = $("#flujo-pasos"), info = $("#flujo-info"), mock = $("#flujo-mock"), detalle = $("#flujo-detalle");
let actual = 0, temporizador = null, pausado = false;

lista.innerHTML = PASOS.map((p, i) => `<li><button type="button" role="tab" data-i="${i}" aria-selected="false" aria-controls="flujo-detalle">
  <span class="paso-num">${i + 1}</span><span class="paso-nombre">${p.nombre}</span></button></li>`).join("");

function mostrar(i, manual = false) {
  actual = i;
  const p = PASOS[i];
  $$("button", lista).forEach((b, k) => {
    b.setAttribute("aria-selected", String(k === i));
    b.classList.toggle("hecho", k < i);
  });
  lista.style.setProperty("--progreso", PASOS.length > 1 ? i / (PASOS.length - 1) : 0);
  info.innerHTML = `<p class="flujo-num">Paso ${i + 1} de ${PASOS.length}</p><h3>${p.nombre}</h3><p class="flujo-hace">${p.hace}</p>
    <dl><dt>Datos</dt><dd>${p.datos}</dd><dt>Obtienes</dt><dd>${p.sale}</dd></dl>`;
  mock.innerHTML = p.mock;
  detalle.classList.remove("entra"); void detalle.offsetWidth; detalle.classList.add("entra");
  if (manual) pausado = true;
}
function avanzar() {
  if (!pausado && !reducido && !document.hidden) mostrar((actual + 1) % PASOS.length);
}
lista.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-i]");
  if (b) mostrar(+b.dataset.i, true);
});
[lista, detalle].forEach((el) => {
  el.addEventListener("mouseenter", () => { pausado = true; });
  el.addEventListener("mouseleave", () => { pausado = false; });
});
mostrar(0);
temporizador = setInterval(avanzar, 6000);

/* ---------- Caminos por perfil ---------- */
const CAMINOS = {
  catastro: {
    titulo: "Gestión Catastral y Hacienda",
    pasos: [
      ["Abre el sector y filtra por A1", "Ve solo los predios con posible construcción no registrada."],
      ["Toma los de mayor puntaje", "La lista viene ordenada: empieza por los primeros veinte."],
      ["Verifica en imagen o en campo", "Satélite, Street View o visita, con la razón escrita en la mano."],
      ["Marca el veredicto y exporta", "Confirmado, descartado o no concluyente, y un CSV para la ruta de la semana."],
    ],
    casos: ["Armar la ruta de visitas de la semana", "Llegar a campo sabiendo qué mirar y por qué", "Medir cuántas alertas se confirman"],
  },
  planeacion: {
    titulo: "Planeación y control",
    pasos: [
      ["Mira el sector en 3D", "Entiende dónde se concentran las diferencias entre registro y terreno."],
      ["Filtra por tipo de alerta", "Separa construcciones no registradas, áreas subregistradas y avalúos atípicos."],
      ["Abre la ficha con trazabilidad", "Cada dato trae su fuente, su fecha y su nivel de confianza."],
      ["Exporta la lista priorizada", "Comparte con tu equipo una lista corta y explicada."],
    ],
    casos: ["Dimensionar cuánto del sector tiene diferencias", "Decidir dónde actualizar la cartografía primero", "Documentar qué se revisó y con qué resultado"],
  },
};
function caminos(perfil) {
  const c = CAMINOS[perfil];
  document.body.dataset.perfil = perfil;
  $$("#pathway-tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.perfil === perfil)));
  $("#pathway").innerHTML = `<div class="pathway-pasos"><h3>${c.titulo}</h3><ol>${c.pasos
    .map(([t, d], i) => `<li style="--i:${i}"><span class="pp-num">${i + 1}</span><div><strong>${t}</strong><p>${d}</p></div></li>`).join("")}</ol></div>
    <aside class="pathway-casos"><h4>Casos de uso</h4><ul>${c.casos.map((x) => `<li>${x}</li>`).join("")}</ul>
    <a class="btn btn-primario" href="/app/">Abrir el mapa</a></aside>`;
}
$("#pathway-tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-perfil]");
  if (b) caminos(b.dataset.perfil);
});
caminos("catastro");

/* ---------- Preguntas frecuentes ---------- */
const FAQ = [
  ["¿Reemplaza la visita de campo?", "No. Te dice a qué predios ir primero y por qué. La verificación y cualquier actuación siguen en manos de la autoridad catastral."],
  ["¿De dónde salen los datos?", "Del Registro 1 y la cartografía predial que la Alcaldía de Neiva publica como datos abiertos (vigencia 2025) y de las huellas de edificaciones Open Buildings de Google Research. Cada ficha muestra sus fuentes y fechas."],
  ["¿Qué tan precisa es?", "La estamos midiendo: una persona revisará 50 predios priorizados y 20 sin alerta con imagen satelital o visita, y publicaremos precisión, exhaustividad y F1. Mientras tanto, trata cada alerta como una pista para verificar, no como una conclusión."],
  ["¿Muestra datos de los propietarios?", "No. El Registro 1 no trae nombres ni documentos, y el proceso se detiene si aparece una columna con datos personales."],
  ["¿Cuánto cuesta?", "El piloto del sector 02 es abierto. Estamos definiendo el esquema de licenciamiento y acompañamiento para más sectores; si te interesa, abre un issue en el repositorio de GitHub y conversamos."],
  ["¿Hay más sectores o zona rural?", "El piloto cubre el sector urbano 02. La ampliación a más barrios y comunas es gradual y depende de validar calidad y utilidad; la zona rural requiere datos y pruebas propios."],
];
$("#faq-lista").innerHTML = FAQ.map(([q, a], i) => `<details class="faq-item aparecer" style="--i:${i}"><summary>${q}</summary><p>${a}</p></details>`).join("");
$$("#faq-lista .aparecer").forEach((el) => (reducido ? el.classList.add("visible") : io.observe(el)));

cifras();
