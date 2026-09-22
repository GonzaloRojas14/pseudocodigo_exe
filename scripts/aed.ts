/**
 * Corre pseudocódigo desde la terminal, sin VS Code. Sirve para probar rápido
 * y para depurar la extensión.
 *
 *   npm run aed -- check ejemplos/corte_1000.frre
 *   npm run aed -- run   ejemplos/demo.frre  "Teclado" 45000 "2026 3 15" s n
 *
 * Los datos de los ARCHIVO y las SECUENCIA se buscan en "<ejercicio>.datos/",
 * igual que en la extensión.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { check } from "../src/checker";
import { run, type Host } from "../src/interpreter";
import { parse } from "../src/parser";

const [comando, archivo, ...entradas] = process.argv.slice(2);

if (!comando || !archivo || !["check", "run"].includes(comando)) {
  console.error("uso: aed <check|run> <archivo.frre> [entradas...]");
  process.exit(2);
}

const fuente = readFileSync(archivo, "utf8");
const parsed = parse(fuente);
const diagnosticos = parsed.program
  ? [...parsed.diagnostics, ...check(parsed.program)]
  : parsed.diagnostics;

for (const d of diagnosticos) {
  console.log(`  [${d.severity}] línea ${d.pos.line}:${d.pos.col} ${d.message}`);
}

const errores = diagnosticos.filter((d) => d.severity === "error");
if (comando === "check") {
  console.log(
    parsed.program && errores.length === 0
      ? `${archivo}: sin errores (${diagnosticos.length} diagnóstico(s))`
      : `${archivo}: ${errores.length} error(es)`
  );
  process.exit(errores.length === 0 ? 0 : 1);
}

if (!parsed.program || errores.length > 0) {
  console.error("no se puede ejecutar: hay errores");
  process.exit(1);
}

const carpeta = join(dirname(archivo), basename(archivo, extname(archivo)) + ".datos");
const pendientes = [...entradas];

const host: Host = {
  write: (texto) => console.log(texto),
  readLine: async () => pendientes.shift() ?? "",
  archivos: {
    ruta: (nombre, extension) => join(carpeta, nombre + extension),
    leer: (nombre, extension) => {
      const destino = join(carpeta, nombre + extension);
      return existsSync(destino) ? readFileSync(destino, "utf8") : undefined;
    },
    escribir: (nombre, extension, contenido) => {
      mkdirSync(carpeta, { recursive: true });
      writeFileSync(join(carpeta, nombre + extension), contenido, "utf8");
    },
  },
};

const empezo = Date.now();
run(parsed.program, host)
  .then(() => console.error(`— fin (${Date.now() - empezo} ms) —`))
  .catch((err) => {
    const donde = err.pos ? ` (línea ${err.pos.line})` : "";
    console.error(`Error de ejecución${donde}: ${err.message}`);
    process.exit(1);
  });
