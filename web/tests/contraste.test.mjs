// Contraste de la paleta de la portada (WCAG 2.x). Lee los tokens de src/tokens.css.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/tokens.css", import.meta.url), "utf8");
const t = Object.fromEntries(
  [...css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1], m[2]]),
);
const luz = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const razon = (a, b) => {
  const [x, y] = [luz(t[a]), luz(t[b])];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const exige = (min, pares) => {
  for (const [a, b] of pares)
    assert.ok(razon(a, b) >= min, `${a} sobre ${b}: ${razon(a, b).toFixed(2)} < ${min}`);
};

test("el texto de la portada llega a 4,5:1 sobre sus fondos", () => {
  exige(4.5, [
    ["sia-ink", "sia-paper"],
    ["sia-muted", "sia-paper"],
    ["sia-muted", "sia-surface"],
    ["sia-muted", "sia-soft"],
    ["sia-muted", "sia-accent-200"],
    ["neiva-verde", "sia-paper"],
    ["neiva-verde", "sia-surface"],
    ["neiva-verde", "sia-soft"],
    ["sia-rio-texto", "sia-paper"],
    ["sia-rio-texto", "sia-soft"],
    ["sia-rio-texto", "sia-surface"],
    ["neiva-rojo", "sia-paper"],
    ["neiva-rojo", "sia-surface"],
    ["neiva-amarillo", "neiva-verde-900"],
    ["sia-accent-200", "neiva-verde-900"],
    ["sia-accent-300", "neiva-verde-900"],
    ["sia-surface", "neiva-verde"],
  ]);
});

test("el borde de los paneles se distingue del fondo (3:1, WCAG 1.4.11)", () => {
  exige(3, [
    ["sia-panel-linea", "sia-paper"],
    ["sia-panel-linea", "sia-surface"],
    ["sia-panel-linea", "sia-soft"],
    ["sia-ink", "sia-paper"],
    ["sia-control", "sia-paper"],
  ]);
});

test("el azul río de línea no se usa como texto: su variante de texto sí pasa", () => {
  assert.ok(razon("neiva-rio", "sia-paper") < 4.5, "si pasa, sobra --sia-rio-texto");
  assert.ok(razon("sia-rio-texto", "sia-paper") >= 4.5);
});

test("los segmentos vecinos de la barra de triangulación se separan por forma o por contraste", () => {
  // Orden de la barra: dos fuentes (río), solo cartografía (río rayado), solo imagen (tinta), sin evidencia (gris).
  // Entre río y río rayado separa el patrón; entre los demás, el contraste debe ser 3:1 o más.
  exige(3, [
    ["neiva-rio", "sia-surface"],
    ["sia-ink", "sia-surface"],
    ["sia-ink", "sia-line-strong"],
  ]);
});
