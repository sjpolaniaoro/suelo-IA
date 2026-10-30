import "./landing.css";
import "./neiva.css";
import "./pitch.css";
import ejemplo from "./ejemplo.json";
const base = import.meta.env.BASE_URL;
const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Bogota",
});
const $ = (selector) => document.querySelector(selector);
async function json(path) {
  const response = await fetch(base + path);
  if (!response.ok) throw new Error("No se pudo leer " + path);
  return response.json();
}
async function mostrarCifras() {
  $("#alertas").setAttribute("aria-busy", "true");
  $("#cifras-estado").textContent = "Leyendo el resumen del piloto.";
  try {
    const r = await json("data/resumen.json");
    if (
      !["predios_con_geometria", "predios_con_alerta", "tasa_cruce"].every(
        (k) => Number.isFinite(r[k]),
      ) ||
      !["A1", "A2", "A3"].every((k) => Number.isFinite(r.alertas?.[k])) ||
      !["sin_area_construida", "habitacionales_no_ph"].every((k) =>
        Number.isFinite(r[k]),
      ) ||
      !r.triangulacion ||
      !["dos_fuentes", "solo_imagen", "solo_cartografia", "sin_evidencia"].every(
        (k) => Number.isFinite(r.triangulacion[k]),
      ) ||
      !["predios_registro", "predios_sin_geometria"].every((k) =>
        Number.isFinite(r[k]),
      ) ||
      !r.contexto_urbano ||
      !["predios_registro", "habitacionales_no_ph", "sin_area_construida"].every(
        (k) => Number.isFinite(r.contexto_urbano[k]),
      ) ||
      !["universo_sin_area", "cola_oficina", "cola_campo"].every((k) =>
        Number.isFinite(r.triangulacion[k]),
      ) ||
      !Number.isFinite(r.predios_uso_no_residencial) ||
      !Number.isFinite(r.confianza_baja) ||
      !Number.isFinite(Date.parse(r.generado))
    )
      throw new Error("Resumen incompleto");
    const values = {
      predios_con_geometria: number.format(r.predios_con_geometria),
      predios_con_alerta: number.format(r.predios_con_alerta),
      tasa_cruce: new Intl.NumberFormat("es-CO", {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(r.tasa_cruce),
      sec_sin_area: number.format(r.sin_area_construida),
      sec_hab: number.format(r.habitacionales_no_ph),
      sec_pct: new Intl.NumberFormat("es-CO", {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(r.sin_area_construida / r.habitacionales_no_ph),
      predios_registro: number.format(r.predios_registro),
      predios_sin_geometria: number.format(r.predios_sin_geometria),
      ctx_registro: number.format(r.contexto_urbano.predios_registro),
      ctx_hab: number.format(r.contexto_urbano.habitacionales_no_ph),
      ctx_sin_area: number.format(r.contexto_urbano.sin_area_construida),
      ctx_pct: new Intl.NumberFormat("es-CO", {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(
        r.contexto_urbano.sin_area_construida /
          r.contexto_urbano.habitacionales_no_ph,
      ),
      tri_universo: number.format(r.triangulacion.universo_sin_area),
      cola_oficina: number.format(r.triangulacion.cola_oficina),
      cola_campo: number.format(r.triangulacion.cola_campo),
      NR: number.format(r.predios_uso_no_residencial),
      por_revisar: number.format(r.predios_con_alerta + r.predios_uso_no_residencial),
      tri_dos_fuentes: number.format(r.triangulacion.dos_fuentes),
      tri_solo_imagen: number.format(r.triangulacion.solo_imagen),
      tri_solo_cartografia: number.format(r.triangulacion.solo_cartografia),
      tri_sin_evidencia: number.format(r.triangulacion.sin_evidencia),
      confianza_baja: number.format(r.confianza_baja),
      generado: date.format(new Date(r.generado)),
      ...Object.fromEntries(
        ["A1", "A2", "A3"].map((k) => [k, number.format(r.alertas[k])]),
      ),
    };
    document.querySelectorAll("[data-stat]").forEach((el) => {
      el.textContent = values[el.dataset.stat];
    });
    // Los anchos de la barra salen del resumen; sin ellos la barra no se muestra.
    document.querySelectorAll("[data-tri]").forEach((el) => {
      el.style.flexGrow = r.triangulacion[el.dataset.tri];
    });
    $(".sia-tri-barra").hidden = false;
    $("#cifras-estado").textContent =
      "Conteos del resumen del piloto. Las alertas orientan la revisión y no confirman hallazgos.";
  } catch {
    document.querySelectorAll("[data-stat]").forEach((el) => {
      el.textContent = "No disponible";
    });
    $("#cifras-estado").textContent =
      "Cifras no disponibles. Puedes consultar las fuentes del proyecto o intentar de nuevo al recargar.";
  } finally {
    $("#alertas").setAttribute("aria-busy", "false");
  }
}
function mostrarEjemplo() {
  // Ficha generada desde el GeoJSON por scripts/generar-plano.mjs.
  $("#ejemplo-direccion").textContent = ejemplo.direccion;
  $("#ejemplo-npn").textContent = "NPN " + ejemplo.npn;
  $("#ejemplo-registro").textContent = number.format(
    ejemplo.area_construida_reg,
  );
  $("#ejemplo-huella").textContent = number.format(ejemplo.area_huella);
  const tope = Math.max(ejemplo.area_construida_reg, ejemplo.area_huella, 1);
  $("#barra-registro").style.width = Math.max(2, (ejemplo.area_construida_reg / tope) * 100) + "%";
  $("#barra-huella").style.width = Math.max(2, (ejemplo.area_huella / tope) * 100) + "%";
  $("#ejemplo-razon").textContent = ejemplo.razon;
  $("#ejemplo-confianza").textContent = "Confianza " + ejemplo.confianza;
  $("#ejemplo-enlace").href =
    base + "app/?predio=" + encodeURIComponent(ejemplo.npn);
  $("#ejemplo-contenido").hidden = false;
  $("#ejemplo-estado").hidden = true;
  document.querySelectorAll("[data-example-link]").forEach((el) => {
    el.href = base + "app/?predio=" + encodeURIComponent(ejemplo.npn);
    el.hidden = false;
  });
  $("[data-example-area]").textContent = number.format(ejemplo.area_huella);
}
const form = $("#solicitud-piloto");
form.hidden = false;
function prepararSolicitud() {
  if (!form.reportValidity()) return null;
  const fields = new FormData(form);
  const municipio = fields.get("municipio").trim();
  const subject = "Solicitud de piloto Suelo-IA – " + municipio;
  const body = [
    "Hola, equipo de Suelo-IA.",
    "",
    ...[
      ["Entidad", "entidad"],
      ["Municipio", "municipio"],
      ["Cargo", "cargo"],
      ["Correo de contacto", "correo"],
      ["Qué queremos revisar", "comentario"],
    ].map(
      ([label, key]) =>
        label + ": " + (fields.get(key).trim() || "Sin comentario"),
    ),
  ].join("\n");
  $("#piloto-texto").value = subject + "\n\n" + body;
  $("#piloto-borrador").hidden = false;
  return (
    "mailto:" +
    form.dataset.destino +
    "?subject=" +
    encodeURIComponent(subject) +
    "&body=" +
    encodeURIComponent(body)
  );
}
form.addEventListener("submit", (event) => {
  event.preventDefault();
  const href = prepararSolicitud();
  if (!href) return;
  $("#piloto-estado").textContent =
    "Solicitud preparada. Revísala y envíala desde tu aplicación de correo. Si no se abre, puedes copiar el texto de abajo.";
  const enlace = $("#piloto-abrir");
  enlace.href = href;
  enlace.hidden = false;
  enlace.click();
});
$("#piloto-copiar").addEventListener("click", async () => {
  if (!prepararSolicitud()) return;
  try {
    await navigator.clipboard.writeText($("#piloto-texto").value);
    $("#piloto-estado").textContent =
      "Solicitud copiada. Pégala en un correo para el equipo de Suelo-IA.";
  } catch {
    $("#piloto-estado").textContent =
      "Puedes seleccionar y copiar el texto de la solicitud preparada que aparece abajo.";
    $("#piloto-texto").focus();
    $("#piloto-texto").select();
  }
});
const menu = $(".sia-menu"),
  nav = $("#navegacion");
menu.hidden = false;
document.documentElement.classList.add("sia-con-js");
const cerrar = () => {
  menu.setAttribute("aria-expanded", "false");
  nav.classList.remove("sia-nav-open");
};
menu.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") !== "true";
  menu.setAttribute("aria-expanded", String(open));
  nav.classList.toggle("sia-nav-open", open);
});
nav.addEventListener("click", (event) => {
  if (event.target.closest("a")) cerrar();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menu.getAttribute("aria-expanded") === "true") {
    cerrar();
    menu.focus();
  }
});
window.matchMedia("(min-width: 761px)").addEventListener("change", cerrar);
// QR flotante, sin texto: tres estados (normal, ampliado con un clic en el QR, minimizado a un icono) que se
// recuerdan durante la sesión. Escape devuelve el QR ampliado a su tamaño normal.
function iniciarQrFlotante() {
  const caja = $("#qr-flotante");
  if (!caja) return;
  const qr = $("#qr-ampliar");
  const minimizar = $("#qr-minimizar");
  const mostrar = $("#qr-mostrar");
  let estado = "normal";
  try {
    estado = sessionStorage.getItem("sia-qr") || "normal";
  } catch {}
  const aplicar = (nuevo) => {
    estado = nuevo;
    caja.classList.toggle("sia-qr-grande", nuevo === "grande");
    caja.classList.toggle("sia-qr-min", nuevo === "min");
    qr.setAttribute("aria-pressed", String(nuevo === "grande"));
    minimizar.setAttribute("aria-expanded", String(nuevo !== "min"));
    mostrar.hidden = nuevo !== "min";
    try {
      sessionStorage.setItem("sia-qr", nuevo);
    } catch {}
  };
  qr.addEventListener("click", () => aplicar(estado === "grande" ? "normal" : "grande"));
  minimizar.addEventListener("click", () => aplicar("min"));
  mostrar.addEventListener("click", () => {
    aplicar("normal");
    qr.focus();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && estado === "grande") aplicar("normal");
  });
  aplicar(estado);
  caja.hidden = false;
  // En #demo ya hay otro QR igual a la vista: se oculta el flotante mientras tanto.
  const enDemo = $(".sia-qr");
  if (enDemo && "IntersectionObserver" in window)
    new IntersectionObserver(([e]) => {
      caja.hidden = e.isIntersecting;
    }).observe(enDemo);
}
iniciarQrFlotante();
mostrarCifras();
mostrarEjemplo();
json("data/manifiesto.json")
  .then((m) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(m.vigencia_registro1 || ""))
      $("#vigencia").textContent =
        "Vigencia " + m.vigencia_registro1.slice(0, 4);
  })
  .catch(() => {
    $("#vigencia").textContent = "Vigencia no disponible; consultar fuentes";
  });
