import "./landing.css";
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
  $(".sia-stats").setAttribute("aria-busy", "true");
  $("#cifras-estado").textContent = "Leyendo el resumen del piloto.";
  try {
    const r = await json("data/resumen.json");
    if (
      !["predios_con_geometria", "predios_con_alerta", "tasa_cruce"].every(
        (k) => Number.isFinite(r[k]),
      ) ||
      !["A1", "A2", "A3"].every((k) => Number.isFinite(r.alertas?.[k])) ||
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
      generado: date.format(new Date(r.generado)),
      ...Object.fromEntries(
        ["A1", "A2", "A3"].map((k) => [k, number.format(r.alertas[k])]),
      ),
    };
    document.querySelectorAll("[data-stat]").forEach((el) => {
      el.textContent = values[el.dataset.stat];
    });
    $("#cifras-estado").textContent =
      "Conteos del resumen del piloto. Las alertas orientan la revisión y no confirman hallazgos.";
  } catch {
    document.querySelectorAll("[data-stat]").forEach((el) => {
      el.textContent = "No disponible";
    });
    $("#cifras-estado").textContent =
      "Cifras no disponibles. Puedes consultar las fuentes del proyecto o intentar de nuevo al recargar.";
  } finally {
    $(".sia-stats").setAttribute("aria-busy", "false");
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
