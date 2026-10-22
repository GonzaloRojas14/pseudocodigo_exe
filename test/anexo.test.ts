/**
 * El dialecto del Anexo de las actividades formativas: fin_reg, parámetros
 * separados por ";", Procedimiento X(...); sin ES, ABRIR(arch) sin modo, y
 * los datos de un ARCHIVO en un .csv separado por comas.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { errors, execute, type Archivos } from "./helpers";

const PROGRAMA = `
ACCION anexo ES
AMBIENTE
    M = 2;
    N = 3;
    lectura = registro
        sensor: entero;
        nro: entero;
        valor: real;
    fin_reg;
    reg: lectura;
    archLecturas: ARCHIVO de lectura;
    matriz: ARREGLO[1..M, 1..N] de real;
    v: ARREGLO[1..N] de real;

    Procedimiento ExtraerFila(matriz: ARREGLO[1..M,1..N] de real;
                              fila: entero; var v: ARREGLO[1..N] de real);
    Proceso
        PARA j := 1 HASTA N HACER
            v[j] := matriz[fila, j];
        FIN_PARA;
    fin_proc;
PROCESO
    ABRIR(archLecturas);
    LEER(archLecturas, reg);
    MIENTRAS NFDA(archLecturas) HACER
        matriz[reg.sensor, reg.nro] := reg.valor;
        LEER(archLecturas, reg);
    FIN_MIENTRAS;
    CERRAR(archLecturas);
    ExtraerFila(matriz, 2, v);
    ESCRIBIR(v[1], " ", v[2], " ", v[3]);
FIN_ACCION`;

test("los ejemplos del Anexo pasan el checker tal cual", () => {
  assert.deepStrictEqual(errors(PROGRAMA), []);
});

test("ABRIR(arch) sin modo lee, y el ARCHIVO se carga de un .csv con comas", async () => {
  const archivos: Archivos = {
    "archLecturas.csv": "sensor,nro,valor\n1,1,20.5\n2,1,19.0\n1,2,21\n2,2,19.5\n1,3,22\n2,3,20.25\n",
  };
  assert.deepStrictEqual(await execute(PROGRAMA, [], archivos), ["19 19.5 20.25"]);
});

test("si están los dos, manda el .tsv", async () => {
  const archivos: Archivos = {
    "archLecturas.tsv": "sensor\tnro\tvalor\n2\t1\t1\n2\t2\t2\n2\t3\t3\n",
    "archLecturas.csv": "sensor,nro,valor\n2,1,9\n2,2,9\n2,3,9\n",
  };
  assert.deepStrictEqual(await execute(PROGRAMA, [], archivos), ["1 2 3"]);
});
