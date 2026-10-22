/**
 * Parámetros de procedimientos y funciones: por valor y por referencia (var),
 * con escalares, componentes, arreglos, registros y punteros; funciones y
 * recursión; ámbito; y las formas en que la teoría y la guía los escriben.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { analyze, execute } from "./helpers";

type Caso = { nombre: string; src: string; entrada?: string[]; salida?: string[]; error?: RegExp; aviso?: RegExp };
const NODO = `NODO = REGISTRO
      dato: entero;
      prox: Puntero a NODO;
    FIN_REGISTRO;`;
const casos: Caso[] = [
  { nombre: "A1 teoría: FUNCION ES_PRIMO textual (con V y F)", src: `
ACCION t ES
AMBIENTE
    n : entero
    FUNCION ES_PRIMO(A : entero) : logico
        AMBIENTE
            i : entero
        PROCESO
            ES_PRIMO := V
            PARA i := 2 HASTA (A - 1) HACER
                SI A MOD i = 0 ENTONCES
                    ES_PRIMO := F
                FIN_SI
            FIN_PARA
    FIN_FUNCION
PROCESO
    ESCRIBIR(ES_PRIMO(7), " ", ES_PRIMO(9))
FIN_ACCION`, salida: ["verdadero falso"] },
  { nombre: "A2 teoría: PROCEDIMIENTO Login textual (nombres agrupados, sin AMBIENTE)", src: `
ACCION t ES
AMBIENTE
    PROCEDIMIENTO Login(usu, pass, valid : alfanumerico)
        SI pass = valid ENTONCES
            ESCRIBIR('Acceso autorizado a ', usu)
        SINO
            ESCRIBIR('Login inválido para ', usu)
        FIN_SI
    FIN_PROCEDIMIENTO
PROCESO
    Login('ana', '123', '123')
    Login('beto', 'x', '123')
FIN_ACCION`, salida: ["Acceso autorizado a ana", "Login inválido para beto"] },
  { nombre: "B1 valor no cambia el original; var sí", src: `
ACCION t ES
AMBIENTE
    x, y : entero
    PROCEDIMIENTO P(a : entero; var b : entero) ES
        a := a + 100
        b := b + 100
    FIN_PROCEDIMIENTO
PROCESO
    x := 1; y := 1
    P(x, y)
    ESCRIBIR(x, " ", y)
FIN_ACCION`, salida: ["1 101"] },
  { nombre: "B2 guía 32.08: intercambiar con var a, b agrupados", src: `
ACCION t ES
AMBIENTE
    x, y : entero
    PROCEDIMIENTO Intercambiar(var a, b : entero) ES
        AMBIENTE aux : entero
        PROCESO
        aux := a; a := b; b := aux
    FIN_PROCEDIMIENTO
PROCESO
    x := 1; y := 2
    Intercambiar(x, y)
    ESCRIBIR(x, " ", y)
FIN_ACCION`, salida: ["2 1"] },
  { nombre: "B3 var sobre componente de arreglo, campo de registro y campo de nodo", src: `
ACCION t ES
AMBIENTE
    ${NODO}
    R = REGISTRO c : entero FIN_REGISTRO
    v : ARREGLO[1..3] de entero
    r : R
    p : Puntero a NODO
    PROCEDIMIENTO Duplicar(var n : entero) ES
        n := n * 2
    FIN_PROCEDIMIENTO
PROCESO
    v[2] := 5; r.c := 6; NUEVO(p); *p.dato := 7
    Duplicar(v[2]); Duplicar(r.c); Duplicar(*p.dato)
    ESCRIBIR(v[2], " ", r.c, " ", *p.dato)
FIN_ACCION`, salida: ["10 12 14"] },
  { nombre: "B4 arreglo por valor es copia; por var es el mismo", src: `
ACCION t ES
AMBIENTE
    v, w : ARREGLO[1..2] de entero
    PROCEDIMIENTO Poner(a : ARREGLO[1..2] de entero; var b : ARREGLO[1..2] de entero) ES
        a[1] := 99
        b[1] := 99
    FIN_PROCEDIMIENTO
PROCESO
    v[1] := 1; w[1] := 1
    Poner(v, w)
    ESCRIBIR(v[1], " ", w[1])
FIN_ACCION`, salida: ["1 99"] },
  { nombre: "B5 registro por valor es copia; por var es el mismo", src: `
ACCION t ES
AMBIENTE
    R = REGISTRO c : entero FIN_REGISTRO
    a, b : R
    PROCEDIMIENTO Poner(x : R; var y : R) ES
        x.c := 99
        y.c := 99
    FIN_PROCEDIMIENTO
PROCESO
    a.c := 1; b.c := 1
    Poner(a, b)
    ESCRIBIR(a.c, " ", b.c)
FIN_ACCION`, salida: ["1 99"] },
  { nombre: "B6 puntero por valor: cambia el nodo pero no el puntero; por var cambia PRIM", src: `
ACCION t ES
AMBIENTE
    ${NODO}
    PRIM, Q : Puntero a NODO
    PROCEDIMIENTO InsertarMal(L : Puntero a NODO; x : entero) ES
        AMBIENTE N : Puntero a NODO
        PROCESO
        NUEVO(N); *N.dato := x; *N.prox := L; L := N
    FIN_PROCEDIMIENTO
    PROCEDIMIENTO InsertarBien(var L : Puntero a NODO; x : entero) ES
        AMBIENTE N : Puntero a NODO
        PROCESO
        NUEVO(N); *N.dato := x; *N.prox := L; L := N
    FIN_PROCEDIMIENTO
    PROCEDIMIENTO Duplicar(L : Puntero a NODO) ES
        *L.dato := *L.dato * 2
    FIN_PROCEDIMIENTO
PROCESO
    PRIM := NIL
    InsertarBien(PRIM, 1)
    InsertarMal(PRIM, 2)
    InsertarBien(PRIM, 3)
    Duplicar(PRIM)
    Q := PRIM
    MIENTRAS Q <> NIL HACER ESCRIBIR(*Q.dato); Q := *Q.prox; FIN_MIENTRAS
FIN_ACCION`, salida: ["6", "1"] },
  { nombre: "B7 un literal a un parámetro var es error", src: `
ACCION t ES
AMBIENTE
    PROCEDIMIENTO P(var b : entero) ES
        b := 1
    FIN_PROCEDIMIENTO
PROCESO
    P(5)
FIN_ACCION`, error: /por referencia/ },
  { nombre: "C1 recursión: factorial y Fibonacci de la guía (TP5 1.01 y 1.02)", src: `
ACCION t ES
AMBIENTE
    FUNCION Fact(n : entero) : entero ES
        SI n = 0 ENTONCES Fact := 1 SINO Fact := n * Fact(n - 1) FIN_SI
    FIN_FUNCION
    FUNCION Fib(n : entero) : entero ES
        SI (n = 1) O (n = 2) ENTONCES Fib := 1 SINO Fib := Fib(n - 1) + Fib(n - 2) FIN_SI
    FIN_FUNCION
PROCESO
    ESCRIBIR(Fact(5), " ", Fib(10))
FIN_ACCION`, salida: ["120 55"] },
  { nombre: "C2 función dentro de una cuenta (guía TP5 2.02: K := Calc(X,Y) * 3 + ABSO(Y-10))", src: `
ACCION t ES
AMBIENTE
    X, Y, K : entero
    FUNCION Suma(a, b : entero) : entero ES
        Suma := a + b
    FIN_FUNCION
PROCESO
    X := 4; Y := 3
    K := Suma(X, Y) * 3 + ABSO(Y - 10)
    ESCRIBIR(K)
FIN_ACCION`, salida: ["28"] },
  { nombre: "C3 función como argumento de otra", src: `
ACCION t ES
AMBIENTE
    FUNCION Cuad(a : entero) : entero ES
        Cuad := a * a
    FIN_FUNCION
    FUNCION Mas1(a : entero) : entero ES
        Mas1 := a + 1
    FIN_FUNCION
PROCESO
    ESCRIBIR(Cuad(Mas1(Cuad(2))))
FIN_ACCION`, salida: ["25"] },
  { nombre: "C4 función entera que devuelve 2.5 es error", src: `
ACCION t ES
AMBIENTE
    x : entero
    FUNCION F(a : entero) : entero ES
        F := a / 2
    FIN_FUNCION
PROCESO
    x := F(5)
FIN_ACCION`, error: /entera|DIV/ },
  { nombre: "C5 función que nunca asigna su resultado avisa", src: `
ACCION t ES
AMBIENTE
    x : entero
    FUNCION F(a : entero) : entero ES
        x := a
    FIN_FUNCION
PROCESO
    x := F(5)
FIN_ACCION`, aviso: /nunca asigna su resultado/ },
  { nombre: "C6 teoría: una FUNCION sin parámetros (la teoría dice que no puede)", src: `
ACCION t ES
AMBIENTE
    x : entero
    FUNCION F() : entero ES
        F := 1
    FIN_FUNCION
PROCESO
    x := F()
FIN_ACCION`, aviso: /no puede estar vacía|parámetros/ },
  { nombre: "C7 función con parámetro var modifica el original", src: `
ACCION t ES
AMBIENTE
    x, y : entero
    FUNCION Doble(var a : entero) : entero ES
        a := a * 2
        Doble := a
    FIN_FUNCION
PROCESO
    x := 3
    y := Doble(x)
    ESCRIBIR(x, " ", y)
FIN_ACCION`, salida: ["6 6"] },
  { nombre: "D1 cantidad de argumentos distinta es error", src: `
ACCION t ES
AMBIENTE
    PROCEDIMIENTO P(a, b : entero) ES
        ESCRIBIR(a + b)
    FIN_PROCEDIMIENTO
PROCESO
    P(1)
FIN_ACCION`, error: /espera 2 parámetro/ },
  { nombre: "D2 un real a un parámetro entero es error", src: `
ACCION t ES
AMBIENTE
    PROCEDIMIENTO P(a : entero) ES
        ESCRIBIR(a)
    FIN_PROCEDIMIENTO
PROCESO
    P(2.5)
FIN_ACCION`, error: /entera|entero/ },
  { nombre: "D3 un procedimiento dentro de una expresión es error", src: `
ACCION t ES
AMBIENTE
    x : entero
    PROCEDIMIENTO P(a : entero) ES
        ESCRIBIR(a)
    FIN_PROCEDIMIENTO
PROCESO
    x := P(1)
FIN_ACCION`, error: /PROCEDIMIENTO/ },
  { nombre: "E1 ámbito: local tapa a global, global visible, local invisible afuera", src: `
ACCION t ES
AMBIENTE
    x, g : entero
    PROCEDIMIENTO P(a : entero) ES
        AMBIENTE x : entero
        PROCESO
        x := 50
        g := g + a
    FIN_PROCEDIMIENTO
PROCESO
    x := 1; g := 10
    P(5)
    ESCRIBIR(x, " ", g)
FIN_ACCION`, salida: ["1 15"] },
  { nombre: "E2 recursión con procedimiento (guía TP5 2.01: inverso de 254)", src: `
ACCION t ES
AMBIENTE
    PROCEDIMIENTO Inverso(n : entero) ES
        ESCRIBIR(n MOD 10)
        SI n DIV 10 > 0 ENTONCES Inverso(n DIV 10) FIN_SI
    FIN_PROCEDIMIENTO
PROCESO
    Inverso(254)
FIN_ACCION`, salida: ["4", "5", "2"] },
  { nombre: "E3 procedimiento que llama a otro declarado después", src: `
ACCION t ES
AMBIENTE
    PROCEDIMIENTO A1(n : entero) ES
        B1(n + 1)
    FIN_PROCEDIMIENTO
    PROCEDIMIENTO B1(n : entero) ES
        ESCRIBIR(n)
    FIN_PROCEDIMIENTO
PROCESO
    A1(1)
FIN_ACCION`, salida: ["2"] },
  { nombre: "F1 guía TP2: Subacción print_tot(totmas,totmen: entero) es; ... FSubacción;", src: `
ACCION t ES
AMBIENTE
    a, b : entero
    Subacción print_tot(totmas,totmen: entero) es;
        Esc('Total ', totmas + totmen);
    FSubacción;
    Subacción corte es;
        print_tot(a, b);
    FSubaccion;
PROCESO
    a := 3; b := 4
    corte
FIN_ACCION`, salida: ["Total 7"] },
  { nombre: "F2 guía TP5: Acción Calc (ALFA, JOTA: entero): entero es ... Faccion", src: `
ACCION t ES
AMBIENTE
    X, Y, Z : entero
    Acción Calc_102 (ALFA, JOTA: entero): entero es
        AMBIENTE BETA : entero
        PROCESO
        BETA := ALFA**JOTA;
        ALFA := ALFA + BETA;
        Calc_102 := ALFA;
    Faccion
PROCESO
    X := 7; Y := 2
    Z := Calc_102(X, Y)
    ESCRIBIR(Z, " ", X)
FIN_ACCION`, salida: ["56 7"] },
  { nombre: "F3 Anexo AF3: Procedimiento X(a: T; var b: T); ... fin_proc;", src: `
ACCION t ES
AMBIENTE
    x : entero;
    Procedimiento Sumar(a: entero; var b: entero);
    Proceso
        b := b + a;
    fin_proc;
PROCESO
    x := 1;
    Sumar(4, x);
    ESCRIBIR(x);
FIN_ACCION`, salida: ["5"] },
];

for (const c of casos) {
  test(c.nombre, async () => {
    const { diagnostics } = analyze(c.src);
    const errs = diagnostics.filter((d) => d.severity === "error").map((d) => d.message);
    const avisos = diagnostics.filter((d) => d.severity !== "error").map((d) => d.message);
    if (c.aviso) {
      assert.ok(avisos.some((a) => c.aviso!.test(a)), `avisos: ${avisos.join(" | ")}`);
      return;
    }
    if (c.error) {
      if (errs.some((e) => c.error!.test(e))) return;
      assert.deepStrictEqual(errs, [], "errores inesperados");
      await assert.rejects(execute(c.src, c.entrada ?? []), c.error);
      return;
    }
    assert.deepStrictEqual(errs, []);
    assert.deepStrictEqual(await execute(c.src, c.entrada ?? []), c.salida);
  });
}

test("Y y O son operadores entre dos operandos, y variables en declaraciones, argumentos y asignaciones", async () => {
  const salida = await execute(`ACCION yo ES
AMBIENTE
    a, b, x, y, o : entero
    c : caracter
    l, m : logico
PROCESO
    a := 2; b := 1; c := 'e'; x := 5
    y := 7
    o := 9
    l := verdadero
    m := falso
    SI (a > 1) Y (b < 2) ENTONCES ESCRIBIR("1 ok") FIN_SI
    SI a = 2 Y b = 1 ENTONCES ESCRIBIR("2 ok") FIN_SI
    SI c = 'a' O c = 'e' ENTONCES ESCRIBIR("3 ok") FIN_SI
    SI l Y NO m ENTONCES ESCRIBIR("4 ok") FIN_SI
    SI (a > 5)
       O (b = 1) ENTONCES ESCRIBIR("5 ok") FIN_SI
    SI y = 7 Y o = 9 ENTONCES ESCRIBIR("6 ok: y=", y, " o=", o) FIN_SI
    SI x > y O y > x ENTONCES ESCRIBIR("7 ok") FIN_SI
    ESCRIBIR("8 ", x + y * o)
FIN_ACCION
`);
  assert.deepStrictEqual(salida, ["1 ok", "2 ok", "3 ok", "4 ok", "5 ok", "6 ok: y=7 o=9", "7 ok", "8 68"]);
});

// ── arreglos como parámetro: con el tipo escrito, con ";" y con un tipo declarado ──

test("arreglo por var y por valor con el tipo en el parámetro, separados con coma", async () => {
  assert.deepStrictEqual(await execute(`ACCION t ES
AMBIENTE
    v : ARREGLO[1..5] de entero
    i, s : entero
    PROCEDIMIENTO Cargar(var a : ARREGLO[1..5] de entero, n : entero) ES
        AMBIENTE k : entero
        PROCESO
        PARA k := 1 HASTA n HACER a[k] := k * 10 FIN_PARA
    FIN_PROCEDIMIENTO
    FUNCION Sumar(a : ARREGLO[1..5] de entero) : entero ES
        AMBIENTE k, t : entero
        PROCESO
        t := 0
        PARA k := 1 HASTA 5 HACER t := t + a[k] FIN_PARA
        Sumar := t
    FIN_FUNCION
PROCESO
    Cargar(v, 5)
    ESCRIBIR(Sumar(v))
FIN_ACCION
`), ["150"]);
});

test("lo mismo con los parámetros separados por ; (como el Anexo)", async () => {
  assert.deepStrictEqual(await execute(`ACCION t ES
AMBIENTE
    v : ARREGLO[1..5] de entero
    i, s : entero
    PROCEDIMIENTO Cargar(var a : ARREGLO[1..5] de entero; n : entero) ES
        AMBIENTE k : entero
        PROCESO
        PARA k := 1 HASTA n HACER a[k] := k * 10 FIN_PARA
    FIN_PROCEDIMIENTO
    FUNCION Sumar(a : ARREGLO[1..5] de entero) : entero ES
        AMBIENTE k, t : entero
        PROCESO
        t := 0
        PARA k := 1 HASTA 5 HACER t := t + a[k] FIN_PARA
        Sumar := t
    FIN_FUNCION
PROCESO
    Cargar(v, 5)
    ESCRIBIR(Sumar(v))
FIN_ACCION
`), ["150"]);
});

test("tipo declarado aparte: vector = ARREGLO[1..N] de entero, y P(var a: vector)", async () => {
  assert.deepStrictEqual(await execute(`ACCION t ES
AMBIENTE
    N = 5
    vector = ARREGLO[1..N] de entero
    v : vector
    PROCEDIMIENTO Cargar(var a : vector) ES
        AMBIENTE k : entero
        PROCESO
        PARA k := 1 HASTA N HACER a[k] := k FIN_PARA
    FIN_PROCEDIMIENTO
    FUNCION Sumar(a : vector) : entero ES
        AMBIENTE k, t : entero
        PROCESO
        t := 0
        PARA k := 1 HASTA N HACER t := t + a[k] FIN_PARA
        Sumar := t
    FIN_FUNCION
PROCESO
    Cargar(v)
    ESCRIBIR(Sumar(v))
FIN_ACCION
`), ["15"]);
});

test("matriz por var y arreglo de registros por valor", async () => {
  assert.deepStrictEqual(await execute(`ACCION t ES
AMBIENTE
    alu = REGISTRO
        leg : entero
        nota : real
    FIN_REGISTRO
    m : ARREGLO[1..2, 1..3] de entero
    curso : ARREGLO[1..3] de alu
    PROCEDIMIENTO Llenar(var x : ARREGLO[1..2, 1..3] de entero) ES
        AMBIENTE i, j : entero
        PROCESO
        PARA i := 1 HASTA 2 HACER PARA j := 1 HASTA 3 HACER x[i, j] := i * 10 + j FIN_PARA FIN_PARA
    FIN_PROCEDIMIENTO
    FUNCION Promedio(c : ARREGLO[1..3] de alu) : real ES
        AMBIENTE i : entero; s : real
        PROCESO
        s := 0
        PARA i := 1 HASTA 3 HACER s := s + c[i].nota FIN_PARA
        Promedio := s / 3
    FIN_FUNCION
PROCESO
    Llenar(m)
    curso[1].nota := 6; curso[2].nota := 8; curso[3].nota := 10
    ESCRIBIR(m[2, 3], " ", Promedio(curso))
FIN_ACCION
`), ["23 8"]);
});

test("tipos con nombre: punt = Puntero a NODO, dia = 1..31, nombre = AN(5), fila y tabla", async () => {
  const fuente = `ACCION t ES
AMBIENTE
    punt = Puntero a NODO
    NODO = REGISTRO
        dato : entero
        prox : punt
    FIN_REGISTRO
    dia = 1..31
    nombre = AN(5)
    fila = ARREGLO[1..3] de entero
    tabla = ARREGLO[1..2] de fila
    PRIM, p : punt
    d : dia
    n : nombre
    t : tabla
    FUNCION Mayor(a : fila) : entero ES
        AMBIENTE i, m : entero
        PROCESO
        m := a[1]
        PARA i := 2 HASTA 3 HACER SI a[i] > m ENTONCES m := a[i] FIN_SI FIN_PARA
        Mayor := m
    FIN_FUNCION
    FUNCION Siguiente(x : dia) : dia ES
        Siguiente := x + 1
    FIN_FUNCION
PROCESO
    NUEVO(PRIM); *PRIM.dato := 1; NUEVO(p); *p.dato := 2; *p.prox := NIL; *PRIM.prox := p
    p := PRIM
    MIENTRAS p <> NIL HACER ESCRIBIR("nodo ", *p.dato); p := *p.prox FIN_MIENTRAS
    n := "abcdefgh"
    ESCRIBIR("n = ", n)
    t[2][1] := 4; t[2][2] := 9; t[2][3] := 7
    ESCRIBIR("mayor de la fila 2: ", Mayor(t[2]))
    d := Siguiente(30)
    ESCRIBIR("d = ", d)
    d := 40
FIN_ACCION
`;
  await assert.rejects(execute(fuente), /"d" está declarada 1..31 y se le intentó guardar 40/);
  const sinElError = fuente.replace("    d := 40\n", "");
  assert.deepStrictEqual(await execute(sinElError), [
    "nodo 1", "nodo 2",
    "[aviso] el texto se recortó a 5 caracteres (AN(5)).",
    "n = abcde",
    "mayor de la fila 2: 9",
    "d = 31",
  ]);
});
