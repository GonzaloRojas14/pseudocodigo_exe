/**
 * Los patrones canónicos de la cátedra, ejecutados de punta a punta con salida
 * exacta. Si alguno de estos se rompe, se rompió el tema entero, no un detalle.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execute, errors, type Archivos } from "./helpers";

// ── MEZCLA ────────────────────────────────────────────────────────────────

test("mezcla inclusiva con HV: los dos archivos se agotan", async () => {
  const archivos: Archivos = {
    "a.tsv": "clave\tvalor\n1\tA1\n3\tA3\n7\tA7\n",
    "b.tsv": "clave\tvalor\n2\tB2\n3\tB3\n9\tB9\n",
  };
  const salida = await execute(
    `
    ACCION mezcla_inclusiva ES
        Ambiente
            HV = 99999
            reg = REGISTRO
                clave : entero
                valor : AN(10)
            FIN_REGISTRO
            a, b : ARCHIVO de reg
            ra, rb : reg

            PROCEDIMIENTO leer_a ES
                Proceso
                    LEER(a, ra)
                    SI FDA(a) ENTONCES ra.clave := HV FIN_SI
            FIN_PROCEDIMIENTO

            PROCEDIMIENTO leer_b ES
                Proceso
                    LEER(b, rb)
                    SI FDA(b) ENTONCES rb.clave := HV FIN_SI
            FIN_PROCEDIMIENTO
        Proceso
            ABRIR E/(a) ; ABRIR E/(b)
            leer_a ; leer_b
            MIENTRAS (ra.clave <> HV) O (rb.clave <> HV) HACER
                SI (ra.clave < rb.clave) ENTONCES
                    ESCRIBIR("solo A: ", ra.clave, " ", ra.valor)
                    leer_a
                SINO
                    SI (ra.clave = rb.clave) ENTONCES
                        ESCRIBIR("ambos: ", ra.clave, " ", ra.valor, "+", rb.valor)
                        leer_a ; leer_b
                    SINO
                        ESCRIBIR("solo B: ", rb.clave, " ", rb.valor)
                        leer_b
                    FIN_SI
                FIN_SI
            FIN_MIENTRAS
            CERRAR(a) ; CERRAR(b)
    FIN_ACCION
  `,
    [],
    archivos
  );
  assert.deepStrictEqual(salida, [
    "solo A: 1 A1",
    "solo B: 2 B2",
    "ambos: 3 A3+B3",
    "solo A: 7 A7",
    "solo B: 9 B9",
  ]);
});

test("mezcla exclusiva: ciclo con Y más los dos vaciados", async () => {
  const archivos: Archivos = {
    "a.tsv": "clave\n1\n3\n7\n8\n",
    "b.tsv": "clave\n2\n3\n",
  };
  const salida = await execute(
    `
    ACCION mezcla_exclusiva ES
        Ambiente
            reg = REGISTRO
                clave : entero
            FIN_REGISTRO
            a, b : ARCHIVO de reg
            ra, rb : reg
        Proceso
            ABRIR E/(a) ; ABRIR E/(b)
            LEER(a, ra) ; LEER(b, rb)
            MIENTRAS NFDA(a) Y NFDA(b) HACER
                SI (ra.clave < rb.clave) ENTONCES
                    ESCRIBIR("A ", ra.clave) ; LEER(a, ra)
                SINO
                    SI (ra.clave = rb.clave) ENTONCES
                        ESCRIBIR("AB ", ra.clave) ; LEER(a, ra) ; LEER(b, rb)
                    SINO
                        ESCRIBIR("B ", rb.clave) ; LEER(b, rb)
                    FIN_SI
                FIN_SI
            FIN_MIENTRAS
            MIENTRAS NFDA(a) HACER
                ESCRIBIR("vaciado A ", ra.clave) ; LEER(a, ra)
            FIN_MIENTRAS
            MIENTRAS NFDA(b) HACER
                ESCRIBIR("vaciado B ", rb.clave) ; LEER(b, rb)
            FIN_MIENTRAS
            CERRAR(a) ; CERRAR(b)
    FIN_ACCION
  `,
    [],
    archivos
  );
  assert.deepStrictEqual(salida, ["A 1", "B 2", "AB 3", "vaciado A 7", "vaciado A 8"]);
});

// ── ACTUALIZACIÓN UNITARIA ────────────────────────────────────────────────

test("actualización unitaria: las seis celdas de la tabla, y el alta no pisa el maestro", async () => {
  // Regresión del bug B.6: la rama de alta usaba reg_mae como borrador y
  // destruía un registro del maestro que todavía no se había procesado.
  const archivos: Archivos = {
    "arch_mae.tsv": "clave\tcant\n10\t100\n20\t200\n30\t300\n",
    "arch_mov.tsv": "clave\ttipo\tcant\n15\tA\t15\n20\tM\t5\n25\tB\t0\n30\tA\t0\n",
  };
  const salida = await execute(
    `
    ACCION act_unitaria ES
        Ambiente
            HV = 99999
            mae = REGISTRO
                clave : entero
                cant  : entero
            FIN_REGISTRO
            mov = REGISTRO
                clave : entero
                tipo  : ('A','B','M')
                cant  : entero
            FIN_REGISTRO
            arch_mae, arch_mae_act : ARCHIVO de mae
            arch_mov : ARCHIVO de mov
            reg_mae, reg_mae_act : mae
            reg_mov : mov

            PROCEDIMIENTO leer_mae ES
                Proceso
                    LEER(arch_mae, reg_mae)
                    SI FDA(arch_mae) ENTONCES reg_mae.clave := HV FIN_SI
            FIN_PROCEDIMIENTO

            PROCEDIMIENTO leer_mov ES
                Proceso
                    LEER(arch_mov, reg_mov)
                    SI FDA(arch_mov) ENTONCES reg_mov.clave := HV FIN_SI
            FIN_PROCEDIMIENTO
        Proceso
            ABRIR E/(arch_mae) ; ABRIR E/(arch_mov) ; ABRIR /S(arch_mae_act)
            leer_mae ; leer_mov
            MIENTRAS (reg_mae.clave <> HV) O (reg_mov.clave <> HV) HACER
                SI (reg_mae.clave < reg_mov.clave) ENTONCES
                    ESCRIBIR(arch_mae_act, reg_mae)
                    leer_mae
                SINO
                    SI (reg_mae.clave = reg_mov.clave) ENTONCES
                        SEGUN reg_mov.tipo HACER
                            'A' : ESCRIBIR("ERROR alta existente ", reg_mov.clave)
                                  ESCRIBIR(arch_mae_act, reg_mae)
                            'B' : ESCRIBIR("baja ", reg_mov.clave)
                            'M' : reg_mae.cant := reg_mae.cant + reg_mov.cant
                                  ESCRIBIR(arch_mae_act, reg_mae)
                        FIN_SEGUN
                        leer_mae ; leer_mov
                    SINO
                        SEGUN reg_mov.tipo HACER
                            'A' : reg_mae_act.clave := reg_mov.clave
                                  reg_mae_act.cant  := reg_mov.cant
                                  ESCRIBIR(arch_mae_act, reg_mae_act)
                            'B' : ESCRIBIR("ERROR baja inexistente ", reg_mov.clave)
                            'M' : ESCRIBIR("ERROR modif inexistente ", reg_mov.clave)
                        FIN_SEGUN
                        leer_mov
                    FIN_SI
                FIN_SI
            FIN_MIENTRAS
            CERRAR(arch_mae) ; CERRAR(arch_mov) ; CERRAR(arch_mae_act)
    FIN_ACCION
  `,
    [],
    archivos
  );

  assert.deepStrictEqual(salida, [
    "ERROR baja inexistente 25",
    "ERROR alta existente 30",
  ]);

  // el maestro nuevo: 10 intacto, 15 dado de alta, 20 modificado (200+5),
  // 30 conservado pese al error. Nada duplicado, nada perdido.
  assert.strictEqual(
    archivos["arch_mae_act.tsv"],
    "clave\tcant\n10\t100\n15\t15\n20\t205\n30\t300\n"
  );
});

// ── PROCESO ESTADÍSTICO ───────────────────────────────────────────────────

test("proceso estadístico: matriz con márgenes y los cuatro incrementos cierran", async () => {
  const archivos: Archivos = {
    "v.tsv": "fila\tcol\timporte\n1\t1\t10\n1\t2\t20\n2\t1\t30\n2\t2\t40\n1\t1\t5\n",
  };
  const salida = await execute(
    `
    ACCION estadistico ES
        Ambiente
            venta = REGISTRO
                fila : 1..2
                col  : 1..2
                importe : real
            FIN_REGISTRO
            v : ARCHIVO de venta
            r : venta
            T : ARREGLO[1..3, 1..3] de real
            i, j : entero
        Proceso
            PARA i := 1 HASTA 3 HACER
                PARA j := 1 HASTA 3 HACER
                    T[i,j] := 0
                FIN_PARA
            FIN_PARA
            ABRIR E/(v)
            LEER(v, r)
            MIENTRAS NFDA(v) HACER
                T[r.fila, r.col] := T[r.fila, r.col] + r.importe
                T[r.fila, 3]     := T[r.fila, 3]     + r.importe
                T[3, r.col]      := T[3, r.col]      + r.importe
                T[3, 3]          := T[3, 3]          + r.importe
                LEER(v, r)
            FIN_MIENTRAS
            CERRAR(v)
            PARA i := 1 HASTA 3 HACER
                ESCRIBIR(T[i,1], " ", T[i,2], " ", T[i,3])
            FIN_PARA
    FIN_ACCION
  `,
    [],
    archivos
  );
  // celdas: [15 20 | 35] [30 40 | 70] / columnas: 45 60 | 105
  assert.deepStrictEqual(salida, ["15 20 35", "30 40 70", "45 60 105"]);

  // los márgenes tienen que cerrar: última fila = suma de las de arriba
  const filas = salida.map((l) => l.split(" ").map(Number));
  assert.strictEqual(filas[0][2] + filas[1][2], filas[2][2]);
  assert.strictEqual(filas[2][0] + filas[2][1], filas[2][2]);
});

// ── ARREGLOS: búsqueda y ordenamiento ─────────────────────────────────────

test("búsqueda binaria encuentra y descarta, sin colgarse", async () => {
  const salida = await execute(
    `
    ACCION binaria ES
        Ambiente
            A : ARREGLO[1..7] de entero
            izq, der, medio, buscado, i : entero
            encontrado : logico
            PROCEDIMIENTO buscar ES
                Proceso
                    izq := 1
                    der := 7
                    encontrado := falso
                    MIENTRAS (izq <= der) Y (NO encontrado) HACER
                        medio := (izq + der) DIV 2
                        SI (A[medio] = buscado) ENTONCES
                            encontrado := verdadero
                        SINO
                            SI (buscado < A[medio]) ENTONCES
                                der := medio - 1
                            SINO
                                izq := medio + 1
                            FIN_SI
                        FIN_SI
                    FIN_MIENTRAS
                    SI encontrado ENTONCES
                        ESCRIBIR(buscado, " en posicion ", medio)
                    SINO
                        ESCRIBIR(buscado, " no esta")
                    FIN_SI
            FIN_PROCEDIMIENTO
        Proceso
            PARA i := 1 HASTA 7 HACER
                A[i] := i * 10
            FIN_PARA
            buscado := 10 ; buscar
            buscado := 70 ; buscar
            buscado := 40 ; buscar
            buscado := 35 ; buscar
            buscado := 99 ; buscar
    FIN_ACCION
  `
  );
  assert.deepStrictEqual(salida, [
    "10 en posicion 1",
    "70 en posicion 7",
    "40 en posicion 4",
    "35 no esta",
    "99 no esta",
  ]);
});

test("ordenamiento por intercambio, con la bandera que corta", async () => {
  const salida = await execute(
    `
    ACCION burbujeo ES
        Ambiente
            A : ARREGLO[1..5] de entero
            j, X, pasadas : entero
            Bandera : logico
        Proceso
            A[1] := 44 ; A[2] := 55 ; A[3] := 12 ; A[4] := 94 ; A[5] := 42
            pasadas := 0
            Bandera := falso
            MIENTRAS (NO Bandera) HACER
                Bandera := verdadero
                pasadas := pasadas + 1
                PARA j := 1 HASTA 4 HACER
                    SI (A[j] > A[j+1]) ENTONCES
                        X := A[j]
                        A[j] := A[j+1]
                        A[j+1] := X
                        Bandera := falso
                    FIN_SI
                FIN_PARA
            FIN_MIENTRAS
            ESCRIBIR(A[1], " ", A[2], " ", A[3], " ", A[4], " ", A[5])
            ESCRIBIR("pasadas: ", pasadas)
    FIN_ACCION
  `
  );
  // ordenado, y la pasada extra de verificación está incluida
  assert.deepStrictEqual(salida, ["12 42 44 55 94", "pasadas: 4"]);
});

test("ordenamiento por selección", async () => {
  const salida = await execute(
    `
    ACCION seleccion ES
        Ambiente
            A : ARREGLO[1..5] de entero
            i, j, x, MIN : entero
        Proceso
            A[1] := 44 ; A[2] := 55 ; A[3] := 12 ; A[4] := 94 ; A[5] := 42
            PARA i := 1 HASTA 4 HACER
                x := A[i]
                MIN := i
                PARA j := (i+1) HASTA 5 HACER
                    SI (A[j] < x) ENTONCES
                        MIN := j
                        x := A[j]
                    FIN_SI
                FIN_PARA
                A[MIN] := A[i]
                A[i] := x
            FIN_PARA
            ESCRIBIR(A[1], " ", A[2], " ", A[3], " ", A[4], " ", A[5])
    FIN_ACCION
  `
  );
  assert.deepStrictEqual(salida, ["12 42 44 55 94"]);
});

test("vectores paralelos: la posición i se refiere a lo mismo en los dos", async () => {
  const salida = await execute(
    `
    ACCION paralelos ES
        Ambiente
            nombres : ARREGLO[1..4] de AN(20)
            sexos   : ARREGLO[1..4] de caracter
            i : entero
        Proceso
            nombres[1] := "Ana"  ; sexos[1] := 'f'
            nombres[2] := "Beto" ; sexos[2] := 'm'
            nombres[3] := "Cami" ; sexos[3] := 'f'
            nombres[4] := "Dani" ; sexos[4] := 'm'
            PARA i := 1 HASTA 4 HACER
                SI (sexos[i] = 'f') ENTONCES
                    ESCRIBIR(nombres[i])
                FIN_SI
            FIN_PARA
    FIN_ACCION
  `
  );
  assert.deepStrictEqual(salida, ["Ana", "Cami"]);
});

test("arreglos de 3 y 4 dimensiones, con control de rango en cada una", async () => {
  const salida = await execute(
    `
    ACCION multi ES
        Ambiente
            C : ARREGLO[1..2, 1..3, 1..4] de entero
            H : ARREGLO[1..2, 1..2, 1..2, 1..2] de entero
            i, j, k, celdas : entero
        Proceso
            celdas := 0
            PARA i := 1 HASTA 2 HACER
                PARA j := 1 HASTA 3 HACER
                    PARA k := 1 HASTA 4 HACER
                        C[i,j,k] := i*100 + j*10 + k
                        celdas := celdas + 1
                    FIN_PARA
                FIN_PARA
            FIN_PARA
            H[2,2,2,2] := 42
            ESCRIBIR(celdas, " ", C[2,3,4], " ", C[1,1,1], " ", H[2,2,2,2])
    FIN_ACCION
  `
  );
  assert.deepStrictEqual(salida, ["24 234 111 42"]);
});

test("el índice fuera de rango se detecta en cualquier dimensión", () => {
  const fuente = `
    ACCION rango3d ES
        Ambiente
            C : ARREGLO[1..2, 1..3, 1..4] de entero
        Proceso
            C[2,3,5] := 1
    FIN_ACCION
  `;
  assert.ok(errors(fuente).some((m) => /5 queda fuera del rango declarado \[1\.\.4\]/.test(m)));
});

// ── RECURSIVIDAD ──────────────────────────────────────────────────────────

test("recursividad: factorial y fibonacci", async () => {
  const salida = await execute(
    `
    ACCION recursion ES
        Ambiente
            FUNCION fact(x : entero) : entero ES
                Proceso
                    SI (x = 0) ENTONCES
                        fact := 1
                    SINO
                        fact := x * fact(x - 1)
                    FIN_SI
            FIN_FUNCION
            FUNCION fibo(n : entero) : entero ES
                Proceso
                    SI (n <= 1) ENTONCES
                        fibo := n
                    SINO
                        fibo := fibo(n-1) + fibo(n-2)
                    FIN_SI
            FIN_FUNCION
        Proceso
            ESCRIBIR(fact(0), " ", fact(5), " ", fact(10))
            ESCRIBIR(fibo(10))
    FIN_ACCION
  `
  );
  assert.deepStrictEqual(salida, ["1 120 3628800", "55"]);
});

// ── EL LENGUAJE EN SÍ ─────────────────────────────────────────────────────

test("los identificadores son case-insensitive, las palabras clave también", async () => {
  const salida = await execute(
    `
    accion Mezclada es
        ambiente
            PersonA = registro
                NomBre : an(20)
                EdaD   : entero
            fin_registro
            p : PERSONA
            TOTAL : entero
        proceso
            P.nombre := "Ana"
            p.EDAD := 30
            total := 0
            total := TOTAL + p.edad
            escribir(p.NOMBRE, " ", Total)
    fin_accion
  `
  );
  assert.deepStrictEqual(salida, ["Ana 30"]);
});

test("un programa entero en notación vieja se ejecuta igual", async () => {
  const salida = await execute(
    `
    Accion vieja Es
        Ambiente
            i, suma : entero
            Funcion doble(x : entero) : entero Es
                Algoritmo
                    doble := x * 2
            FinFuncion
        Algoritmo
            suma := 0
            Para i := 1 hasta 3 Hacer
                suma := suma + doble(i)
            FinPara
            Si suma > 10 Entonces
                Escribir("mayor: ", suma)
            Contrario
                Escribir("menor: ", suma)
            FinSi
    FinAccion
  `
  );
  assert.deepStrictEqual(salida, ["mayor: 12"]);
});

test('"arr" como arreglo y ARR(sec) como primitiva, en el mismo programa', async () => {
  const salida = await execute(
    `
    ACCION ambiguos ES
        Ambiente
            arr : arreglo de [1..3] de entero
            sec : SECUENCIA de caracter
            v : caracter
            i, cant : entero
        Proceso
            PARA i := 1 HASTA 3 HACER
                arr[i] := i * 7
            FIN_PARA
            cant := 0
            ARR(sec)
            AVZ(sec, v)
            MIENTRAS NFDS(sec) HACER
                cant := cant + 1
                AVZ(sec, v)
            FIN_MIENTRAS
            ESCRIBIR(arr[3], " ", cant)
    FIN_ACCION
  `,
    [],
    { "sec.txt": "abcde" }
  );
  assert.deepStrictEqual(salida, ["21 5"]);
});

test("el operador EN en sus tres formas", async () => {
  const salida = await execute(
    `
    ACCION pertenencias ES
        Ambiente
            c : caracter
            n : entero
            consonantes : AN(21)
            v : ARREGLO[1..3] de entero
        Proceso
            consonantes := "bcdfghjklmnpqrstvwxyz"
            v[1] := 4 ; v[2] := 7 ; v[3] := 9
            c := 'p'
            SI (c EN consonantes) ENTONCES ESCRIBIR("texto: si") FIN_SI
            n := 7
            SI (n EN v) ENTONCES ESCRIBIR("arreglo: si") FIN_SI
            SI (c EN ('p','q','r')) ENTONCES ESCRIBIR("literal: si") FIN_SI
            SI (NO (c EN ('a','e','i'))) ENTONCES ESCRIBIR("literal negado: si") FIN_SI
    FIN_ACCION
  `
  );
  assert.deepStrictEqual(salida, [
    "texto: si",
    "arreglo: si",
    "literal: si",
    "literal negado: si",
  ]);
});

test("un límite de arreglo que no es constante se explica en vez de fallar raro", () => {
  const fuente = `
    ACCION limite_variable ES
        Ambiente
            n : entero
            v : ARREGLO[1..n] de entero
        Proceso
            n := 5
    FIN_ACCION
  `;
  assert.ok(
    errors(fuente).some((m) => /constante numérica|se fija al declararlo/i.test(m)),
    "el mensaje tiene que explicar por qué no puede ser una variable"
  );
});
