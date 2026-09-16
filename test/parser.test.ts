import assert from "node:assert/strict";
import { test } from "node:test";
import { tokenize } from "../src/lexer";
import { parse } from "../src/parser";
import { analyze, errors, execute, warnings } from "./helpers";

/** Ejercicio real (Ejercicios Rojas.md, 1.1.5.3): notación vieja en mayúsculas y nombre con puntos. */
const EJ_1_1_5_3 = `
//Se desea comprar una PC y una impresora.

ACCION 1.1.5.3 ES
    AMBIENTE
        iva = 1.21
        por_pc = 1.12
        por_imp = 1.07
        costo_pc, costo_imp, precio_total: REAL
    PROCESO
        ESCRIBIR("Ingrese el costo de la PC y luego el de la impresora: ")
        LEER(costo_pc, costo_imp)
        precio_total := (costo_pc * por_pc) + (costo_imp * por_imp)
        precio_total := precio_total * iva
        ESCRIBIR("El precio total es: ", precio_total)
FIN_ACCION
`;

test("parsea un ejercicio real con AMBIENTE/PROCESO en mayúscula y constantes sin tipo", () => {
  assert.deepEqual(errors(EJ_1_1_5_3), []);
});

test("el nombre de ACCION con puntos se avisa pero no rompe", () => {
  const avisos = warnings(EJ_1_1_5_3);
  assert.ok(avisos.some((m) => m.includes("no lleva puntos")), avisos.join(" | "));
});

test("y ese mismo ejercicio corre y calcula bien", async () => {
  const output = await execute(EJ_1_1_5_3, ["1000 500"]);
  // (1000 * 1.12 + 500 * 1.07) * 1.21
  assert.equal(output.at(-1), "El precio total es: 2002.55");
});

test("ENTONCES con dos puntos se acepta con aviso (errores-y-trampas #24)", () => {
  const source = `
    ACCION con_dos_puntos ES
        Ambiente
            a, b : entero
        Proceso
            a := 1
            b := 2
            SI a > b ENTONCES:
                ESCRIBIR("mayor")
            SINO
                ESCRIBIR("menor")
            FIN_SI
    FIN_ACCION
  `;
  assert.deepEqual(errors(source), []);
  assert.ok(warnings(source).some((m) => m.includes("dos puntos")));
});

test("FIN_PROCESO se acepta con aviso: el Proceso no lo lleva", () => {
  const source = `
    ACCION con_fin_proceso ES
        Ambiente
        Proceso
            ESCRIBIR("hola")
        FIN_PROCESO
    FIN_ACCION
  `;
  assert.deepEqual(errors(source), []);
  assert.ok(warnings(source).some((m) => m.includes("FIN_PROCESO")));
});

test("acepta la notación vieja completa: Algoritmo / Contrario / FinSi", () => {
  const source = `
    ACCION vieja ES
        Ambiente
            a : entero;
        Algoritmo
            a := 3;
            Si a > 2 Entonces
                ESC("grande");
            Contrario
                ESC("chico");
            FinSi;
    FinAccion.
  `;
  assert.deepEqual(errors(source), []);
});

test("mezclar notación moderna y vieja se avisa", () => {
  const source = `
    ACCION mezclada ES
        Ambiente
            a : entero
        Algoritmo
            a := 1
            SI a = 1 ENTONCES
                ESCRIBIR("uno")
            FIN_SI
    FIN_ACCION
  `;
  assert.ok(warnings(source).some((m) => m.includes("mezcla la notación")));
});

test("declaraciones de archivos, secuencias e indexados", () => {
  const source = `
    ACCION declaraciones ES
        Ambiente
            fecha = REGISTRO
                anio : 1900..9999
                mes  : 1..12
                dia  : 1..31
            FIN_REGISTRO

            alumno = REGISTRO
                apyn      : AN(50)
                carrera   : ('ISI','IEM','IQ')
                nro_leg   : N(8)
                promedio  : N(5,2)
                fecha_nac : fecha
            FIN_REGISTRO

            arch_alu  : ARCHIVO de alumno ordenado por carrera, nro_leg y apyn
            arch_idx  : ARCHIVO de alumno INDEXADO por nro_leg
            sec       : SECUENCIA de caracter
            V         : ARREGLO[1..10] de entero
            M         : ARREGLO[1..3, 1..3] de real
        Proceso
            ESCRIBIR("ok")
    FIN_ACCION
  `;
  assert.deepEqual(errors(source), []);
});

test("las instrucciones de archivo y secuencia se parsean (aunque todavía no se ejecuten)", () => {
  const source = `
    ACCION archivos ES
        Ambiente
            reg = REGISTRO
                clave : entero
            FIN_REGISTRO
            arch : ARCHIVO de reg
            sal  : ARCHIVO de reg
            idx  : ARCHIVO de reg INDEXADO por clave
            sec  : SECUENCIA de caracter
            r : reg
            v : caracter
        Proceso
            ABRIR E/(arch); ABRIR /S(sal); ABRIR E/S(idx)
            ARR(sec); AVZ(sec, v)
            LEER(arch, r)
            MIENTRAS NFDA(arch) Y NFDS(sec) HACER
                ESCRIBIR(sal, r)
                AVZ(sec, v)
                LEER(arch, r)
            FIN_MIENTRAS
            r.clave := 5
            LEER(idx, r)
            SI EXISTE ENTONCES
                RE-ESCRIBIR(idx, r)
            SINO
                ESCRIBIR(idx, r)
            FIN_SI
            ELIMINAR(idx, r)
            CERRAR(arch); CERRAR(sal); CERRAR(idx); CERRAR(sec)
    FIN_ACCION
  `;
  assert.deepEqual(errors(source), []);
});

test('"sec" sigue siendo un nombre de variable válido, y SEC DE CARACTER se acepta con aviso', () => {
  const source = `
    ACCION secuencias ES
        Ambiente
            sec, sal : SEC DE CARACTERES
            v : caracter
        Proceso
            ARR(sec); AVZ(sec, v)
            CERRAR(sec); CERRAR(sal)
    FIN_ACCION
  `;
  assert.deepEqual(errors(source), []);
  assert.ok(warnings(source).some((m) => m.includes("SECUENCIA de caracter")));
});

test("el modo de apertura se reconoce en todas sus formas", () => {
  const modes = (src: string) =>
    tokenize(src)
      .tokens.filter((t) => t.type === "OPENMODE")
      .map((t) => t.value);
  assert.deepEqual(modes("ABRIR E/(a) ABRIR /S(b) ABRIR E/S(c)"), ["E", "S", "ES"]);
  assert.deepEqual(modes("ABRIRe(a) ABRIRs(b) ABRIRe/s(c)"), ["E", "S", "ES"]);
});

test("falta FIN_SI: error con la línea del problema", () => {
  const source = `
    ACCION sin_cerrar ES
        Ambiente
            a : entero
        Proceso
            a := 1
            SI a = 1 ENTONCES
                ESCRIBIR("uno")
    FIN_ACCION
  `;
  const parsed = parse(source);
  const firstError = parsed.diagnostics.find((d) => d.severity === "error");
  assert.ok(firstError?.message.includes("FIN_SI"), firstError?.message);
});

test("el typo ARHCIVO se marca como error", () => {
  const source = `
    ACCION typo ES
        Ambiente
            alumnos = REGISTRO
                apyn : AN(50)
            FIN_REGISTRO
            arch_alumn: ARHCIVO DE alumnos
        Proceso
            ESCRIBIR("hola")
    FIN_ACCION
  `;
  assert.ok(errors(source).length > 0);
});

test("comentarios // , /* */ y # (este último con aviso)", () => {
  const source = `
    // comentario de linea
    /* comentario
       de bloque */
    # comentario que no es notación de la cátedra
    ACCION comentarios ES
        Ambiente
        Proceso
            ESCRIBIR("hola") // al final de la linea
    FIN_ACCION
  `;
  assert.deepEqual(errors(source), []);
  assert.ok(warnings(source).some((m) => m.includes("#")));
});

test("acepta identificadores con ñ y tildes", () => {
  const source = `
    ACCION acentos ES
        Ambiente
            año : entero
            señal : caracter
        Proceso
            año := 2026
            señal := "x"
            ESCRIBIR(año, señal)
    FIN_ACCION
  `;
  assert.deepEqual(errors(source), []);
  assert.ok(analyze(source).ok);
});

test("código pegado de un PDF: comillas tipográficas, menos Unicode y espacios duros", () => {
  const source =
    "﻿" +
    [
      "ACCION pegado_del_pdf ES",
      "    Ambiente",
      "    carrera : (‘ISI’,‘IEM’)",
      "        a, b : entero",
      "    Proceso",
      "        carrera := ‘ISI’",
      "        a := 10 − 3",
      "        b := 4 × 2",
      "        SI (a ≠ b) Y (a ≥ 2) ENTONCES",
      "            ESCRIBIR(“distintos”, a)",
      "        FIN_SI",
      "FIN_ACCION",
    ].join("\n");
  assert.deepEqual(errors(source), []);
  const avisos = warnings(source);
  assert.ok(avisos.some((m) => m.includes("Comillas tipográficas")), avisos.join(" | "));
  assert.ok(avisos.some((m) => m.includes("El signo menos")));
});

test("y ese código pegado además se ejecuta", async () => {
  const source = [
    "ACCION pegado ES",
    "    Ambiente",
    "        a : entero",
    "    Proceso",
    "        a := 10 − 3",
    "        ESCRIBIR(“resultado: ”, a)",
    "FIN_ACCION",
  ].join("\n");
  const output = await execute(source);
  assert.deepEqual(output, ["resultado: 7"]);
});
