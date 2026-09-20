import { check } from "../src/checker";
import type { Diagnostic } from "../src/diagnostics";
import { run, type Host } from "../src/interpreter";
import { parse } from "../src/parser";

export function analyze(source: string): { diagnostics: Diagnostic[]; ok: boolean } {
  const parsed = parse(source);
  const diagnostics = parsed.program
    ? [...parsed.diagnostics, ...check(parsed.program)]
    : parsed.diagnostics;
  return { diagnostics, ok: !!parsed.program && !diagnostics.some((d) => d.severity === "error") };
}

export function errors(source: string): string[] {
  return analyze(source)
    .diagnostics.filter((d) => d.severity === "error")
    .map((d) => d.message);
}

export function warnings(source: string): string[] {
  return analyze(source)
    .diagnostics.filter((d) => d.severity === "warning")
    .map((d) => d.message);
}

/** archivos en memoria: { "arch.tsv": "contenido" } */
export type Archivos = Record<string, string>;

export async function execute(
  source: string,
  inputs: string[] = [],
  archivos?: Archivos
): Promise<string[]> {
  const parsed = parse(source);
  if (!parsed.program) {
    throw new Error(`No parsea: ${parsed.diagnostics.map((d) => d.message).join(" | ")}`);
  }
  const output: string[] = [];
  const queue = [...inputs];
  const host: Host = {
    write: (text) => output.push(text),
    readLine: async () => {
      if (queue.length === 0) throw new Error("El programa pidió más entrada de la esperada.");
      return queue.shift() as string;
    },
    archivos: archivos && {
      ruta: (nombre, extension) => `datos/${nombre}${extension}`,
      leer: (nombre, extension) => archivos[`${nombre}${extension}`],
      escribir: (nombre, extension, contenido) => {
        archivos[`${nombre}${extension}`] = contenido;
      },
    },
  };
  await run(parsed.program, host, { maxSteps: 200_000 });
  return output;
}
