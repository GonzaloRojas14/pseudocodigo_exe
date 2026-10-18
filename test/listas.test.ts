/**
 * Listas con punteros: Puntero a NODO, NIL, NUEVO, DISPONER y el nodo apuntado
 * escrito *p o p^. Los programas están escritos como en las filminas de listas.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { errors, execute, warnings, type Archivos } from "./helpers";
import { parse } from "../src/parser";
import { columnasDe } from "../src/archivos";
import type { RecordDecl } from "../src/ast";

const NODO = `
        NODO = REGISTRO
            dato: entero
            prox: Puntero a NODO
        FIN_REGISTRO`;

test("carga apilada con *p: el último ingresado queda primero", async () => {
  const salida = await execute(
    `
    ACCION apilada ES
        AMBIENTE ${NODO}
            p, PRIM: Puntero a NODO
            valor: entero
        PROCESO
            LEER(valor)
            Prim := nil
            MIENTRAS (valor <> 0) HACER
                NUEVO (p)
                *p.Dato := valor
                *p.Prox := Prim
                Prim := p
                LEER(valor)
            FIN MIENTRAS
            p := PRIM
            MIENTRAS (p <> NIL) HACER
                ESCRIBIR(*p.dato)
                p := *p.prox
            FIN_MIENTRAS
    FIN_ACCION
  `,
    ["1", "2", "3", "0"]
  );
  assert.deepStrictEqual(salida, ["3", "2", "1"]);
});

test("carga encolada con p^ y los cierres escritos con espacio (FIN SI, FIN MIENTRAS)", async () => {
  const salida = await execute(
    `
    ACCION encolada ES
        AMBIENTE ${NODO}
            p, a, PRIM: Puntero a NODO
            valor: entero
        PROCESO
            LEER(valor)
            Prim := nil
            MIENTRAS (valor <> 0) HACER
                NUEVO (p)
                p^.Dato := valor
                p^.Prox := nil
                SI Prim = nil ENTONCES
                    Prim := p
                SINO
                    a^.Prox := p
                FIN SI
                a := p
                LEER(valor)
            FIN MIENTRAS
            p := PRIM
            MIENTRAS p <> NIL HACER
                ESCRIBIR(p^.dato)
                p := p^.prox
            FIN MIENTRAS
    FIN_ACCION
  `,
    ["1", "2", "3", "0"]
  );
  assert.deepStrictEqual(salida, ["1", "2", "3"]);
});

test("inserción ordenada en los 4 casos, con { comentarios }, ; y FIN REGISTRO;", async () => {
  const salida = await execute(
    `
    ACCION INSERCION ES
      AMBIENTE
      NODO = REGISTRO
        DATO: Entero;
        prox: PUNTERO A NODO;
      FIN REGISTRO;
      PRIM, P, Q, ANT: PUNTERO A NODO;
      n, i: entero;
    PROCESO
      PRIM := NIL;
      LEER(n);
      PARA i := 1 HASTA n HACER
        NUEVO(Q); LEER(*Q.DATO);
        SI (PRIM = NIL) ENTONCES
           PRIM := Q;  *Q.prox := NIL;            { CASO 1 }
        SINO
           P := PRIM;  ANT := NIL;
           MIENTRAS (P <> NIL) Y (*P.DATO < *Q.DATO) HACER
              ANT := P;  P := *P.prox;
           FIN MIENTRAS;
           SI (P = PRIM) ENTONCES
              PRIM := Q;  *Q.prox := P;           { CASO 2 }
           SINO
              *ANT.prox := Q;  *Q.prox := P;      { CASO 3 y 4 }
           FIN SI;
        FIN SI;
      FIN_PARA
      P := PRIM;
      MIENTRAS P <> NIL HACER
        ESCRIBIR(*P.DATO);  P := *P.prox;
      FIN MIENTRAS;
    FIN ACCION.
  `,
    ["5", "5", "1", "9", "3", "7"]
  );
  assert.deepStrictEqual(salida, ["1", "3", "5", "7", "9"]);
});

test("lista doble: *(*P.ant).prox enlaza con el anterior y se recorre en los dos sentidos", async () => {
  const fuente = `
    ACCION DOBLE ES
      AMBIENTE
      NODO = REGISTRO
        DATO: Entero;
        prox: PUNTERO A NODO;
        ant:  PUNTERO A NODO;
      FIN REGISTRO;
      PRIM, ULT, P, Q: PUNTERO A NODO;
      n, i, VALOR: entero;
    PROCESO
      PRIM := NIL; ULT := NIL;
      LEER(n);
      PARA i := 1 HASTA n HACER
        NUEVO(Q); LEER(*Q.DATO);
        *Q.prox := NIL; *Q.ant := ULT;
        SI PRIM = NIL ENTONCES PRIM := Q; SINO *ULT.prox := Q; FIN SI;
        ULT := Q;
      FIN_PARA
      LEER(VALOR);
      P := PRIM;
      MIENTRAS (P <> NIL) Y (*P.DATO <> VALOR) HACER P := *P.prox; FIN MIENTRAS;
      { el valor está en el medio }
      *(*P.prox).ant := *P.ant;
      *(*P.ant).prox := *P.prox;
      DISPONER(P);
      P := PRIM;
      MIENTRAS P <> NIL HACER ESCRIBIR(*P.DATO); P := *P.prox; FIN MIENTRAS;
      P := ULT;
      MIENTRAS P <> NIL HACER ESCRIBIR(P^.DATO); P := P^.ant; FIN MIENTRAS;
    FIN ACCION.
  `;
  const salida = await execute(fuente, ["4", "1", "2", "3", "4", "3"]);
  assert.deepStrictEqual(salida, ["1", "2", "4", "4", "2", "1"]);
});

test("p := q: los dos punteros apuntan al mismo nodo", async () => {
  const salida = await execute(`
    ACCION alias ES
        AMBIENTE ${NODO}
            p, q: Puntero a NODO
        PROCESO
            NUEVO(q)
            p := q
            *p.dato := 9
            ESCRIBIR(*q.dato, " ", p = q, " ", *q.prox)
    FIN_ACCION
  `);
  assert.deepStrictEqual(salida, ["9 verdadero NIL"]);
});

test("la ACCION recibe la lista hecha: PRIM se carga del .tsv y ULT apunta al último", async () => {
  const archivos: Archivos = { "PRIM.tsv": "DATO\n2\n4\n6\n" };
  const salida = await execute(
    `
    ACCION RECORRER ES(PRIM, ULT: PUNTERO A NODO);
      AMBIENTE
      NODO = REGISTRO
        DATO: Entero;
        prox: PUNTERO A NODO;
        ant:  PUNTERO A NODO;
      FIN REGISTRO;
      P: PUNTERO A NODO;
    PROCESO
      P := ULT;
      MIENTRAS P <> NIL HACER ESCRIBIR(*P.DATO); P := *P.ant; FIN MIENTRAS;
    FIN ACCION.
  `,
    [],
    archivos
  );
  assert.deepStrictEqual(salida, ["6", "4", "2"]);
});

// ── errores en ejecución ───────────────────────────────────────────────────

const conNodo = (proceso: string) => `
    ACCION t ES
        AMBIENTE ${NODO}
            p, q: Puntero a NODO
        PROCESO
            ${proceso}
    FIN_ACCION`;

test("acceder a *p con p = NIL explica que hay que preguntar p <> NIL", async () => {
  await assert.rejects(execute(conNodo("p := NIL\n ESCRIBIR(*p.dato)")), /"p" vale NIL.*p <> NIL/);
});

test("usar un nodo después de DISPONER es un error", async () => {
  await assert.rejects(
    execute(conNodo("NUEVO(p)\n q := p\n DISPONER(p)\n ESCRIBIR(*q.dato)")),
    /ya se liberó con DISPONER/
  );
});

test("a un puntero no se le asigna un dato", async () => {
  await assert.rejects(execute(conNodo("p := 5")), /Puntero a NODO.*\*p\.dato/);
});

test("los punteros no se ordenan con <", async () => {
  await assert.rejects(
    execute(conNodo('NUEVO(p)\n NUEVO(q)\n SI p < q ENTONCES ESCRIBIR("x") FIN_SI')),
    /solo se comparan con = y <>/
  );
});

// ── checker ────────────────────────────────────────────────────────────────

test("p.dato sin * avisa la notación del nodo apuntado", () => {
  assert.ok(warnings(conNodo("NUEVO(p)\n p.dato := 3")).some((w) => /\*p\.dato/.test(w)));
});

test("* sobre algo que no es puntero y NUEVO de un entero son errores", () => {
  const fuente = `
    ACCION t ES
        AMBIENTE ${NODO}
            x: entero
        PROCESO
            x := 1
            ESCRIBIR(*x.dato)
            NUEVO(x)
    FIN_ACCION`;
  const errs = errors(fuente);
  assert.ok(errs.some((e) => /"x" no es un puntero/.test(e)), errs.join(" | "));
  assert.ok(errs.some((e) => /NUEVO\(x\)/.test(e)), errs.join(" | "));
});

test("Puntero a un registro que no existe es un error", () => {
  const errs = errors(`
    ACCION t ES
        AMBIENTE
            p: Puntero a NADA
        PROCESO
            p := NIL
    FIN_ACCION`);
  assert.ok(errs.some((e) => /"NADA" no está declarado/.test(e)), errs.join(" | "));
});

test("un recorrido que no avanza el puntero avisa ciclo infinito", () => {
  const avisos = warnings(conNodo("p := q\n MIENTRAS p <> NIL HACER\n ESCRIBIR(*p.dato)\n FIN_MIENTRAS"));
  assert.ok(avisos.some((w) => /no termina nunca/.test(w)), avisos.join(" | "));
});

test("un recorrido bien hecho no da avisos (p := *p.prox no es un acumulador)", () => {
  const avisos = warnings(conNodo("NUEVO(q)\n *q.prox := NIL\n p := q\n MIENTRAS p <> NIL HACER\n ESCRIBIR(*p.dato)\n p := *p.prox\n FIN_MIENTRAS"));
  assert.deepStrictEqual(avisos, []);
});

test("puntero y nuevo siguen sirviendo como nombres de variable", async () => {
  const salida = await execute(`
    ACCION t ES
        AMBIENTE
            puntero, nuevo: entero
        PROCESO
            puntero := 2
            nuevo := puntero * 3
            ESCRIBIR(nuevo)
    FIN_ACCION`);
  assert.deepStrictEqual(salida, ["6"]);
});

test("un * al principio de línea sigue siendo multiplicación si no va pegado a un nombre", async () => {
  const salida = await execute(`
    ACCION t ES
        AMBIENTE
            x: entero
        PROCESO
            x := 2
            x := x
              * 3
            ESCRIBIR(x)
    FIN_ACCION`);
  assert.deepStrictEqual(salida, ["6"]);
});

test("PRIM.tsv toma la forma del registro NODO: varios campos y registros anidados, sin los punteros", async () => {
  const archivos: Archivos = {
    "PRIM.tsv":
      "legajo\tnombre\tnota\tfecha.anio\tfecha.mes\n" +
      "101\tAna Paz\t8.5\t2026\t3\n" +
      "205\tBeto Gil\t6\t2025\t11\n",
  };
  const salida = await execute(
    `
    ACCION ALUMNOS ES(PRIM: PUNTERO A NODO);
      AMBIENTE
      FECHA = REGISTRO
        anio: entero;
        mes: 1..12;
      FIN REGISTRO;
      NODO = REGISTRO
        legajo: entero;
        nombre: AN(30);
        nota: real;
        fecha: FECHA;
        prox: PUNTERO A NODO;
      FIN REGISTRO;
      P: PUNTERO A NODO;
    PROCESO
      P := PRIM;
      MIENTRAS P <> NIL HACER
        ESCRIBIR(*P.legajo, " ", *P.nombre, " ", *P.nota, " ", *P.fecha.mes, "/", *P.fecha.anio);
        P := *P.prox;
      FIN MIENTRAS;
    FIN ACCION.
  `,
    [],
    archivos
  );
  assert.deepStrictEqual(salida, ["101 Ana Paz 8.5 3/2026", "205 Beto Gil 6 11/2025"]);
});

test("la plantilla de PRIM.tsv lleva las columnas del NODO y no los punteros", () => {
  const fuente = `
    ACCION t ES(PRIM: PUNTERO A NODO);
      AMBIENTE
      NODO = REGISTRO
        legajo: entero;
        nombre: AN(30);
        prox: PUNTERO A NODO;
        ant: PUNTERO A NODO;
      FIN REGISTRO;
    PROCESO
    FIN ACCION.`;
  const { program } = parse(fuente);
  assert.ok(program);
  const tipos = new Map(
    program.declarations.filter((d) => d.kind === "record").map((d) => [d.name.toLowerCase(), d as RecordDecl])
  );
  const columnas = columnasDe({ kind: "named", name: "NODO", pos: program.pos }, tipos).map((c) => c.titulo);
  assert.deepStrictEqual(columnas, ["legajo", "nombre"]);
});

test("ULT apunta al último nodo de PRIM aunque haya un ULT.tsv (no es una lista aparte)", async () => {
  const archivos: Archivos = { "PRIM.tsv": "dato\n1\n2\n3\n", "ULT.tsv": "dato\n" };
  const salida = await execute(
    `
    ACCION t ES(PRIM, ULT: PUNTERO A NODO);
      AMBIENTE
      NODO = REGISTRO
        dato: entero;
        prox: PUNTERO A NODO;
      FIN REGISTRO;
    PROCESO
      ESCRIBIR(*ULT.dato, " ", *ULT.prox);
    FIN ACCION.`,
    [],
    archivos
  );
  assert.deepStrictEqual(salida, ["3 NIL"]);
});

test("un registro suelto por parámetro (N: NODO) se carga del .tsv: encabezado y una fila", async () => {
  const fuente = `
    ACCION t ES(N: NODO);
      AMBIENTE
      NODO = REGISTRO
        legajo: entero;
        nombre: AN(20);
        prox: PUNTERO A NODO;
      FIN REGISTRO;
    PROCESO
      ESCRIBIR(N.legajo, " ", N.nombre, " ", N.prox);
    FIN ACCION.`;
  assert.deepStrictEqual(await execute(fuente, [], { "N.tsv": "legajo\tnombre\n101\tAna\n" }), ["101 Ana NIL"]);
  await assert.rejects(
    execute(fuente, [], { "N.tsv": "legajo\tnombre\n101\tAna\n102\tBeto\n" }),
    /un solo registro NODO.*2 fila/
  );
});

test("la notación de SINTAXIS.md: NULO como fin de lista y BORRAR(p) para liberar el nodo", async () => {
  const fuente = `
    ACCION baja ES
        AMBIENTE ${NODO}
            PRIM, p, q, ant: Puntero a NODO
            valor, valorBuscado: entero
        PROCESO
            PRIM := NULO
            LEER(valor)
            MIENTRAS valor <> 0 HACER
                NUEVO(q)
                *q.dato := valor
                *q.prox := PRIM
                PRIM := q
                LEER(valor)
            FIN_MIENTRAS
            LEER(valorBuscado)
            p := PRIM; ant := NULO
            MIENTRAS (p <> NULO) Y (*p.dato <> valorBuscado) HACER
                ant := p
                p := *p.prox
            FIN_MIENTRAS
            SI p <> NULO ENTONCES
                SI ant = NULO ENTONCES
                    PRIM := *p.prox
                SINO
                    *ant.prox := *p.prox
                FIN_SI
                BORRAR(p)
            FIN_SI
            p := PRIM
            MIENTRAS p <> NULO HACER
                ESCRIBIR(*p.dato)
                p := *p.prox
            FIN_MIENTRAS
    FIN_ACCION`;
  assert.deepStrictEqual(await execute(fuente, ["1", "2", "3", "0", "2"]), ["3", "1"]);
  // después de BORRAR(p) el nodo ya no se puede usar
  await assert.rejects(
    execute(conNodo("NUEVO(p)\n BORRAR(p)\n ESCRIBIR(*p.dato)")),
    /ya se liberó/
  );
});
