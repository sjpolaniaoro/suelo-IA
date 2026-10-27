// Validación de los archivos que carga la persona («Cargar…»): lo que no cumple el formato esperado se
// rechaza antes de llegar al mapa, a la ficha o al almacenamiento del navegador.
export const LIMITE_BYTES = 30 * 1024 * 1024;
export const ESTADOS = ["confirmado", "descartado", "no_concluyente"];
const NIVELES = ["rojo", "naranja", "amarillo", "sin_alerta", "no_residencial"];
const TRIANGULACION = ["dos_fuentes", "solo_cartografia", "solo_imagen", "sin_evidencia"];
const ACCIONES = ["oficina", "campo"];
const MAX_PREDIOS = 100000;
const NUMEROS = ["area_terreno", "area_construida_reg", "area_huella", "area_cart", "avaluo", "altura"];
const BOOLEANOS = ["A1", "A2", "A3", "NR", "ph"];
const esNumero = (v) => typeof v === "number" && Number.isFinite(v);

export function validarGeojson(fc) {
  if (!fc || fc.type !== "FeatureCollection" || !Array.isArray(fc.features)) {
    throw new Error("El archivo debe ser un FeatureCollection generado por el pipeline.");
  }
  if (fc.features.length === 0) throw new Error("El GeoJSON no trae predios.");
  if (fc.features.length > MAX_PREDIOS) throw new Error(`El GeoJSON trae más de ${MAX_PREDIOS} predios.`);
  fc.features.forEach((f, i) => {
    const p = f?.properties;
    const fallo = (motivo) => {
      throw new Error(`Predio ${i + 1}: ${motivo}.`);
    };
    if (!f || f.type !== "Feature" || !p || typeof p !== "object" || Array.isArray(p)) fallo("no es un Feature con propiedades");
    if (f.geometry !== null && !["Polygon", "MultiPolygon"].includes(f.geometry?.type)) fallo("la geometría debe ser un polígono");
    if (typeof p.npn !== "string" || !/^\d{30}$/.test(p.npn)) fallo("npn debe ser un texto de 30 dígitos");
    if (p.direccion != null && (typeof p.direccion !== "string" || p.direccion.length > 120)) fallo("direccion debe ser un texto de hasta 120 caracteres");
    if (p.puntaje != null && !(esNumero(p.puntaje) && p.puntaje >= 0 && p.puntaje <= 100)) fallo("puntaje debe ser un número de 0 a 100");
    if (p.nivel != null && !NIVELES.includes(p.nivel)) fallo("nivel no es uno de los valores del pipeline");
    if (p.accion != null && !ACCIONES.includes(p.accion)) fallo("accion debe ser oficina o campo");
    if (p.triangulacion != null && !TRIANGULACION.includes(p.triangulacion)) fallo("triangulacion no es un valor del pipeline");
    for (const k of BOOLEANOS) if (p[k] != null && typeof p[k] !== "boolean") fallo(`${k} debe ser verdadero o falso`);
    for (const k of NUMEROS) if (p[k] != null && !esNumero(p[k])) fallo(`${k} debe ser un número`);
    if (p.razones != null && (!Array.isArray(p.razones) || p.razones.length > 20 || p.razones.some((r) => typeof r !== "string" || r.length > 600))) {
      fallo("razones debe ser una lista de textos cortos");
    }
  });
  return fc;
}
