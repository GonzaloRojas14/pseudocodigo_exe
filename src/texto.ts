/** distancia de edición: cuántos retoques hay entre dos palabras */
export function editDistance(a: string, b: string): number {
  const filas = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) filas[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      filas[i][j] = Math.min(filas[i - 1][j] + 1, filas[i][j - 1] + 1, filas[i - 1][j - 1] + costo);
    }
  }
  return filas[a.length][b.length];
}

/**
 * El candidato más parecido a `palabra`, si hay alguno lo bastante cerca como para
 * que valga la pena sugerirlo. La comparación no distingue mayúsculas, igual que
 * el lenguaje.
 */
export function masParecido(palabra: string, candidatos: Iterable<string>): string | undefined {
  const objetivo = palabra.toLowerCase();
  const tolerancia = objetivo.length <= 4 ? 1 : objetivo.length <= 8 ? 2 : 3;
  let mejor: { palabra: string; distancia: number } | undefined;

  for (const candidato of candidatos) {
    const distancia = editDistance(objetivo, candidato.toLowerCase());
    if (distancia === 0) continue;
    if (!mejor || distancia < mejor.distancia) mejor = { palabra: candidato, distancia };
  }

  return mejor && mejor.distancia <= tolerancia ? mejor.palabra : undefined;
}

/** "a", "b" y "c" */
export function enumerar(palabras: string[], union = "y"): string {
  if (palabras.length === 0) return "";
  if (palabras.length === 1) return palabras[0];
  return `${palabras.slice(0, -1).join(", ")} ${union} ${palabras[palabras.length - 1]}`;
}
