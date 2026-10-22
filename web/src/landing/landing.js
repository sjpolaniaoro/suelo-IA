import "./landing.css";
import ejemplo from "./ejemplo.json";
const base = import.meta.env.BASE_URL;
const number = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
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
}
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
