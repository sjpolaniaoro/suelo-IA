// Una sola definición de «pantalla de celular» para el CSS (se repite en styles.css) y para el mapa:
// angosta (vertical) o baja y apaisada (horizontal), donde el diseño de escritorio no cabe.
export const CONSULTA_MOVIL = "(max-width: 860px), (max-height: 500px) and (orientation: landscape)";
export const CONSULTA_APAISADO = "(max-height: 500px) and (orientation: landscape)";
export const esMovil = () => window.matchMedia(CONSULTA_MOVIL).matches;
export const esApaisado = () => window.matchMedia(CONSULTA_APAISADO).matches;
