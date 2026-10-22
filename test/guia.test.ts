/**
 * Los algoritmos de listas de la Guía de Trabajos Prácticos 2026 (Complementos
 * Teóricos y Ejercicios Complementarios del TP 4), transcriptos de la guía.
 * Donde la guía tiene un error se corrigió lo mínimo, marcado en el archivo.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { errors, execute } from "./helpers";

const fixture = (nombre: string) => readFileSync(join(__dirname, "fixtures", nombre), "utf8");
/** saca el menú, que se repite en cada vuelta */
const sinMenu = (salida: string[]) => salida.filter((l) => !/^\*|^ {3}[1-5]-/.test(l));

test("guía, LISTA_CIRCULAR: inserta en el 2º lugar, busca, elimina el primero, el último y el único", async () => {
  const entrada = ["2", "10", "2", "20", "2", "30", "4", "1", "20", "1", "99", "3", "10", "4", "3", "20", "3", "99", "3", "30", "4", "5"];
  assert.deepStrictEqual(sinMenu(await execute(fixture("guia_lista_circular.frre"), entrada)), [
    "10", "30", "20",
    "HALLADO VALOR: 20",
    "ERROR, 99 no está en la Lista",
    "30", "20",
    "ERROR, 99 no está en la Lista",
    "ERROR, Lista Vacía",
  ]);
});

test("guía, LISTA_DOBLE: inserta al final, elimina del medio, el primero y el único", async () => {
  const entrada = ["2", "10", "2", "20", "2", "30", "4", "1", "30", "1", "99", "3", "20", "4", "3", "10", "4", "3", "99", "3", "30", "4", "5"];
  assert.deepStrictEqual(sinMenu(await execute(fixture("guia_lista_doble.frre"), entrada)), [
    "10", "20", "30",
    "HALLADO VALOR: 30",
    "ERROR, 99 no está en la Lista",
    "10", "30",
    "30",
    "ERROR, 99 no está en la Lista",
    "ERROR, Lista Vacía",
  ]);
});

test("guía, complementario 1: las órdenes con P★.PROX dan lo que sale a mano", async () => {
  const salida = await execute(fixture("guia_complementario_1.frre"));
  assert.match(salida[0], /P en 5$/);
  assert.match(salida[1], /Q en 5, P = Q: verdadero$/);
  assert.match(salida[2], /R en 9$/);
  assert.match(salida[3], /P\*\.DATO = 5$/);
  assert.match(salida[4], /P\*\.DATO = 9, Q\*\.DATO = 9$/);
  assert.match(salida[5], /R\*\.PROX = P: verdadero, lista: 9 -> 9 -> 9$/);
});

test("los errores de la guía se detectan: ANT sin declarar, el tipo punt, el Fsi que falta", () => {
  const circular = fixture("guia_lista_circular.frre").replace(/^ANT : puntero a elto;.*\n/m, "");
  assert.ok(errors(circular).some((e) => /"ANT" no está declarada/.test(e)));

  const doble = fixture("guia_lista_doble.frre");
  assert.ok(errors(doble.replace("ant: puntero a elto;", "ant: punt;")).some((e) => /"punt" no está declarado/.test(e)));
  const sinFsi = doble.replace(/^ {8}Fsi; +\{ en la guía falta este Fsi.*\n/m, "");
  assert.ok(errors(sinFsi).some((e) => /Falta FIN_SI: el SI que empieza en la línea \d+ quedó sin cerrar/.test(e)));
});

test("notación de la guía: Ent., Fsi, Fmientras, Freg, Según sin HACER, En [1 .. 5] y Facción.", async () => {
  const salida = await execute(`
    Acción t es
    AMBIENTE
      r = Registro
        n: entero;
      Freg;
      x: r;
      OP: 1 .. 5;
    ALGORITMO
      Repetir Leer (OP) Hasta que OP En [1 .. 3, 5];
      Si OP En [1 .. 3]
        Ent. Escribir ('chico');
        Sino Escribir ('cinco');
      Fsi;
      Según OP
        1: Escribir ('uno');
        5: Escribir ('el cinco');
      Fsegún;
      x.n := 0;
      Mientras x.n < 2 hacer x.n := x.n + 1; Fmientras;
      Escribir (x.n);
    Facción.`, ["4", "5"]);
  assert.deepStrictEqual(salida, ["cinco", "el cinco", "2"]);
});

test("P*.PROX postfijo es el nodo apuntado, y a*b o x * 3 siguen siendo multiplicaciones", async () => {
  const salida = await execute(`
    ACCION t ES
    AMBIENTE
      NODO = registro
        DATO: entero;
        PROX: puntero a NODO;
      Fin registro;
      P, Q: puntero a NODO;
      a, b: entero;
    PROCESO
      NUEVO(Q); Q*.DATO := 7; Q*.PROX := NIL;
      NUEVO(P); P*.DATO := 3; P*.PROX := Q;
      a := 4; b := 5;
      ESCRIBIR((P*.PROX)*.DATO, " ", P* . DATO, " ", a*b, " ", a * 3, " ", P*.DATO*2)
    FIN_ACCION`);
  assert.deepStrictEqual(salida, ["7 3 20 12 6"]);
});
