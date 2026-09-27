/**
 * Los ejemplos que viajan DENTRO del .vsix. Son lo primero que abre alguien que
 * instala la extensión: si uno no corre, la primera impresión es un error.
 * Estos tests corren los archivos reales contra sus datos reales del disco.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, mkdtempSync, cpSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../src/parser";
import { check } from "../src/checker";
import { run, type Host } from "../src/interpreter";

const EJEMPLOS = join(__dirname, "..", "ejemplos");

/** corre un .frre real usando una copia temporal de su carpeta .datos */
async function correr(archivo: string, inputs: string[] = []): Promise<string[]> {
  const fuente = readFileSync(join(EJEMPLOS, archivo), "utf8");
  const parsed = parse(fuente);
  assert.ok(parsed.program, `${archivo} no parsea`);

  const base = archivo.replace(/\.frre$/, "");
  const origen = join(EJEMPLOS, `${base}.datos`);
  // copia temporal: los indexados y los archivos de salida ESCRIBEN,
  // y no queremos que un test ensucie los ejemplos del repo
  const dir = mkdtempSync(join(tmpdir(), "aed-"));
  if (existsSync(origen)) cpSync(origen, dir, { recursive: true });

  const salida: string[] = [];
  const cola = [...inputs];
  const host: Host = {
    write: (t) => salida.push(t),
    readLine: async () => {
      if (cola.length === 0) throw new Error(`${archivo}: pidió más entrada de la esperada`);
      return cola.shift() as string;
    },
    archivos: {
      ruta: (n, e) => join(dir, `${n}${e}`),
      leer: (n, e) => {
        const r = join(dir, `${n}${e}`);
        return existsSync(r) ? readFileSync(r, "utf8") : undefined;
      },
      escribir: (n, e, c) => {
        writeFileSync(join(dir, `${n}${e}`), c);
      },
    },
  };
  await run(parsed.program, host, { maxSteps: 5_000_000 });
  return salida;
}

test("todos los ejemplos publicados parsean y pasan el checker sin errores", () => {
  const archivos = readdirSync(EJEMPLOS).filter((f) => f.endsWith(".frre"));
  assert.ok(archivos.length >= 5, "esperaba al menos 5 ejemplos");
  for (const f of archivos) {
    const fuente = readFileSync(join(EJEMPLOS, f), "utf8");
    const parsed = parse(fuente);
    assert.ok(parsed.program, `${f}: no parsea`);
    const diags = [...parsed.diagnostics, ...check(parsed.program)];
    const errores = diags.filter((d) => d.severity === "error");
    assert.deepStrictEqual(errores.map((e) => e.message), [], `${f} tiene errores`);
  }
});

test("corte_1000: los 1000 registros dan los totales esperados", async () => {
  const salida = await correr("corte_1000.frre");
  const general = salida.find((l) => /^GENERAL:/.test(l));
  assert.ok(general, "no emitió el total general");

  // La prueba de fuego del corte de control: cada nivel tiene que cerrar con
  // el de arriba. Si los resguardos o los acumuladores fallan, esto no cuadra.
  const monto = (l: string) => Number((l.match(/:\s*([0-9.]+)/) || [])[1]);
  const provincias = salida.filter((l) => /^PROVINCIA /.test(l));
  const sucursales = salida.filter((l) => /^\s+sucursal /.test(l));
  const rubros = salida.filter((l) => /^\s+rubro /.test(l));

  assert.ok(provincias.length >= 2, "esperaba varias provincias");
  assert.ok(sucursales.length > provincias.length, "esperaba más sucursales que provincias");
  assert.ok(rubros.length > sucursales.length, "esperaba más rubros que sucursales");

  const suma = (ls: string[]) => ls.reduce((a, l) => a + monto(l), 0);
  const gen = monto(general);
  assert.ok(Math.abs(suma(provincias) - gen) < 0.05, "las provincias no suman el general");
  assert.ok(Math.abs(suma(sucursales) - gen) < 0.05, "las sucursales no suman el general");
  assert.ok(Math.abs(suma(rubros) - gen) < 0.05, "los rubros no suman el general");

  // y las 1000 ventas tienen que estar todas contadas
  const ventas = salida
    .filter((l) => /\((\d+) ventas\)/.test(l) && /^\s+rubro /.test(l))
    .reduce((a, l) => a + Number((l.match(/\((\d+) ventas\)/) || [])[1]), 0);
  assert.strictEqual(ventas, 1000, "no se procesaron las 1000 ventas");
});

test("palabras: la secuencia se recorre y cuenta", async () => {
  const salida = await correr("palabras.frre");
  assert.deepStrictEqual(salida, ["Oraciones: 2", "Palabras: 8"]);
});

test("corte_de_control: corre y emite totales", async () => {
  const salida = await correr("corte_de_control.frre");
  assert.ok(salida.length > 0, "no emitió nada");
});

test("abm_indexado: alta, alta repetida y baja, sin tocar los datos del repo", async () => {
  const salida = await correr("abm_indexado.frre", [
    "S", "A", "777", "Libro nuevo", "12.5",
    "S", "A", "777", // repetida -> error
    "S", "B", "777",
    "N",
  ]);
  assert.ok(salida.some((l) => /YA EXISTE/i.test(l)), "no detectó el alta repetida");
  // el .datos del repo no se tocó: el test trabaja sobre una copia
  const original = readFileSync(
    join(EJEMPLOS, "abm_indexado.datos", "arch_mae.tsv"), "utf8"
  );
  assert.ok(!original.includes("777"), "el test ensució los datos del repo");
});

test("demo: corre entero contestando en minúscula y en mayúscula", async () => {
  // el demo pide: nombre, precio, fecha (anio mes dia), y después S/N
  for (const si of ["s", "S"]) {
    const salida = await correr("demo.frre", ["Yerba", "1500.50", "2026 3 15", si, "n"]);
    assert.ok(
      salida.some((l) => /Yerba/.test(l)),
      `demo no procesó el artículo con "${si}"`
    );
    assert.ok(
      salida.some((l) => /seguimos/.test(l)),
      `la rama '${si}' del SEGUN no entró: las dos formas tienen que andar`
    );
  }
});
