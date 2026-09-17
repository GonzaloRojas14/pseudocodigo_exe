import assert from "node:assert/strict";
import { test } from "node:test";
import { execute } from "./helpers";

test("aritmética, / real y DIV/MOD enteros", async () => {
  const output = await execute(`
    ACCION cuentas ES
        Ambiente
            a : entero
            r : real
        Proceso
            a := 7 DIV 2
            ESCRIBIR("div: ", a)
            a := 7 MOD 2
            ESCRIBIR("mod: ", a)
            r := 7 / 2
            ESCRIBIR("real: ", r)
            ESCRIBIR("potencia: ", 2 ** 10)
    FIN_ACCION
  `);
  assert.deepEqual(output, ["div: 3", "mod: 1", "real: 3.5", "potencia: 1024"]);
});

test("guardar un real en una variable entera es error, y sugiere DIV", async () => {
  await assert.rejects(
    execute(`
      ACCION mal ES
          Ambiente
              a : entero
          Proceso
              a := 7 / 2
      FIN_ACCION
    `),
    /DIV/
  );
});

test("PARA con incremento negativo y con coma", async () => {
  const output = await execute(`
    ACCION cuenta_regresiva ES
        Ambiente
        Proceso
            PARA x := 6 HASTA 2, -2 HACER
                ESCRIBIR(x)
            FIN_PARA
    FIN_ACCION
  `);
  assert.deepEqual(output, ["6", "4", "2"]);
});

test("SEGUN con varios valores por rama y otros", async () => {
  const output = await execute(`
    ACCION menu ES
        Ambiente
            acc : caracter
        Proceso
            PARA i := 1 HASTA 3 HACER
                LEER(acc)
                SEGUN acc HACER
                    'A' : ESCRIBIR("alta")
                    'B', 'M' : ESCRIBIR("baja o modificacion")
                    otros : ESCRIBIR("accion INCORRECTA")
                FIN_SEGUN
            FIN_PARA
    FIN_ACCION
  `, ["A", "M", "Z"]);
  assert.deepEqual(output, ["alta", "baja o modificacion", "accion INCORRECTA"]);
});

test("función: el retorno se asigna al nombre de la función", async () => {
  const output = await execute(`
    ACCION usa_funcion ES
        Ambiente
            FUNCION car_ent(c : caracter) : entero ES
                Proceso
                    SEGUN c HACER
                        "0" : car_ent := 0
                        "1" : car_ent := 1
                        "2" : car_ent := 2
                        otros : car_ent := -1
                    FIN_SEGUN
            FIN_FUNCION
        Proceso
            ESCRIBIR(car_ent("2") + car_ent("1"))
    FIN_ACCION
  `);
  assert.deepEqual(output, ["3"]);
});

test("parámetro por valor no sale; por referencia (var) sí", async () => {
  const output = await execute(`
    ACCION parametros ES
        Ambiente
            n : entero

            PROCEDIMIENTO por_valor(x : entero) ES
                Proceso
                    x := 99
            FIN_PROCEDIMIENTO

            PROCEDIMIENTO por_referencia(var x : entero) ES
                Proceso
                    x := 99
            FIN_PROCEDIMIENTO
        Proceso
            n := 1
            por_valor(n)
            ESCRIBIR("valor: ", n)
            por_referencia(n)
            ESCRIBIR("referencia: ", n)
    FIN_ACCION
  `);
  assert.deepEqual(output, ["valor: 1", "referencia: 99"]);
});

test("una subacción ve las globales pero no las locales de quien la llamó", async () => {
  const output = await execute(`
    ACCION ambito ES
        Ambiente
            cont : entero

            PROCEDIMIENTO tratar_registro ES
                Proceso
                    cont := cont + 1
            FIN_PROCEDIMIENTO
        Proceso
            cont := 0
            tratar_registro
            tratar_registro
            ESCRIBIR(cont)
    FIN_ACCION
  `);
  assert.deepEqual(output, ["2"]);
});

test("registros anidados y copia como una sola entidad", async () => {
  const output = await execute(`
    ACCION registros ES
        Ambiente
            fecha = REGISTRO
                anio : 1800..9999
                mes  : 1..12
                dia  : 1..31
            FIN_REGISTRO

            persona = REGISTRO
                nombre    : AN(50)
                fecha_nac : fecha
            FIN_REGISTRO

            uno, otro : persona
        Proceso
            uno.nombre := "Ada"
            uno.fecha_nac.anio := 1815
            uno.fecha_nac.mes := 12
            uno.fecha_nac.dia := 10
            otro := uno
            otro.nombre := "Grace"
            ESCRIBIR(uno.nombre, " ", uno.fecha_nac.anio)
            ESCRIBIR(otro.nombre, " ", otro.fecha_nac.anio)
    FIN_ACCION
  `);
  assert.deepEqual(output, ["Ada 1815", "Grace 1815"]);
});

test("las fechas se comparan como registro entero si van anio, mes, dia", async () => {
  const output = await execute(`
    ACCION comparar_fechas ES
        Ambiente
            fecha = REGISTRO
                anio : 1900..9999
                mes  : 1..12
                dia  : 1..31
            FIN_REGISTRO
            a, b : fecha
        Proceso
            a.anio := 2024
            a.mes := 3
            a.dia := 15
            b.anio := 2024
            b.mes := 11
            b.dia := 2
            SI (a < b) ENTONCES
                ESCRIBIR("a es anterior")
            SINO
                ESCRIBIR("b es anterior")
            FIN_SI
    FIN_ACCION
  `);
  assert.deepEqual(output, ["a es anterior"]);
});

test("subrango: asignar fuera de rango corta la ejecución", async () => {
  await assert.rejects(
    execute(`
      ACCION subrango ES
          Ambiente
              d : 1..31
          Proceso
              d := 32
      FIN_ACCION
    `),
    /está declarada 1\.\.31 y se le intentó guardar 32/
  );
});

test("enumerado: solo acepta los valores declarados", async () => {
  await assert.rejects(
    execute(`
      ACCION enumerado ES
          Ambiente
              carrera : ('ISI','IEM','IQ')
          Proceso
              carrera := 'LAR'
      FIN_ACCION
    `),
    /solo acepta "ISI", "IEM", "IQ"/
  );
});

test("arreglos y matrices: carga, recorrido y control de límites", async () => {
  const output = await execute(`
    ACCION arreglos ES
        Ambiente
            V : ARREGLO[1..5] de entero
            M : ARREGLO[1..2, 1..3] de entero
            suma : entero
        Proceso
            suma := 0
            PARA i := 1 HASTA 5 HACER
                V[i] := i * i
            FIN_PARA
            PARA i := 1 HASTA 5 HACER
                suma := suma + V[i]
            FIN_PARA
            ESCRIBIR("suma: ", suma)
            PARA i := 1 HASTA 2 HACER
                PARA j := 1 HASTA 3 HACER
                    M[i,j] := i * 10 + j
                FIN_PARA
            FIN_PARA
            ESCRIBIR("M[2,3] = ", M[2,3])
    FIN_ACCION
  `);
  assert.deepEqual(output, ["suma: 55", "M[2,3] = 23"]);
});

test("índice fuera de rango calculado en ejecución", async () => {
  await assert.rejects(
    execute(`
      ACCION fuera ES
          Ambiente
              V : ARREGLO[1..3] de entero
              i : entero
          Proceso
              i := 4
              V[i] := 1
      FIN_ACCION
    `),
    /fuera del rango declarado/
  );
});

test("LEER toma varios valores de una misma línea", async () => {
  const output = await execute(`
    ACCION leer_varios ES
        Ambiente
            a, b, c : real
        Proceso
            ESCRIBIR("Ingresar 3 numeros: ")
            LEER(a, b, c)
            ESCRIBIR(a + b + c)
    FIN_ACCION
  `, ["1 2 3.5"]);
  assert.deepEqual(output, ["Ingresar 3 numeros: ", "6.5"]);
});

test("LEER de un AN(n) toma la línea entera, con espacios incluidos", async () => {
  const output = await execute(`
    ACCION leer_texto ES
        Ambiente
            nombre : AN(50)
            edad : entero
        Proceso
            LEER(nombre)
            LEER(edad)
            ESCRIBIR(nombre, " tiene ", edad)
    FIN_ACCION
  `, ["Ada Lovelace", "36"]);
  assert.deepEqual(output, ["Ada Lovelace tiene 36"]);
});

test("REPETIR ... HASTA QUE se ejecuta al menos una vez", async () => {
  const output = await execute(`
    ACCION menu_repetir ES
        Ambiente
            op : caracter
        Proceso
            REPETIR
                ESCRIBIR("vuelta")
                LEER(op)
            HASTA QUE (op = 'N')
    FIN_ACCION
  `, ["S", "N"]);
  assert.deepEqual(output, ["vuelta", "vuelta"]);
});

test("el ciclo infinito se corta con un mensaje que apunta a la causa", async () => {
  await assert.rejects(
    execute(`
      ACCION infinito ES
          Ambiente
              i : entero
          Proceso
              i := 0
              MIENTRAS (i >= 0) HACER
                  i := i + 1
              FIN_MIENTRAS
      FIN_ACCION
    `),
    /ciclo infinito/
  );
});

test("división por cero", async () => {
  await assert.rejects(
    execute(`
      ACCION div_cero ES
          Ambiente
              a, b : entero
          Proceso
              a := 10
              b := 0
              ESCRIBIR(a DIV b)
      FIN_ACCION
    `),
    /por cero/
  );
});

test("intentar ejecutar archivos avisa que es la próxima entrega", async () => {
  await assert.rejects(
    execute(`
      ACCION con_archivo ES
          Ambiente
              reg = REGISTRO
                  clave : entero
              FIN_REGISTRO
              arch : ARCHIVO de reg
              r : reg
          Proceso
              ABRIR E/(arch)
              LEER(arch, r)
              CERRAR(arch)
      FIN_ACCION
    `),
    /próxima entrega/
  );
});

test("los caracteres se comparan tal cual: 's' no es 'S' (por eso la rama acepta las dos)", async () => {
  const soloMayuscula = `
    ACCION estricto ES
        Ambiente
            op : caracter
        Proceso
            LEER(op)
            SEGUN op HACER
                'S' : ESCRIBIR("sigue")
                otros : ESCRIBIR("opcion INCORRECTA")
            FIN_SEGUN
    FIN_ACCION
  `;
  assert.deepEqual(await execute(soloMayuscula, ["s"]), ["opcion INCORRECTA"]);
  assert.deepEqual(await execute(soloMayuscula, ["S"]), ["sigue"]);

  const ambas = soloMayuscula.replace("'S' :", "'S', 's' :");
  assert.deepEqual(await execute(ambas, ["s"]), ["sigue"]);
});

test("el ejemplo demo.frre corre entero contestando en minúscula", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const source = readFileSync(join(__dirname, "..", "ejemplos", "demo.frre"), "utf8");
  const salida = await execute(source, [
    "Teclado mecanico",
    "45000",
    "2026 3 15",
    "s", // antes esto repetía la pregunta para siempre
    "n",
  ]);
  assert.ok(salida.includes("seguimos"), salida.join(" | "));
  assert.ok(salida.includes("listo"), salida.join(" | "));
  assert.equal(salida.at(-1), "listo");
});
