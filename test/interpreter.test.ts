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

test("subrangos: valor inicial, límites y validación al leer y al pasar parámetros", async () => {
  const salida = await execute(`
    ACCION subrangos ES
        Ambiente
            mes : 1..12
            notas : ARREGLO[1..3] de 1..10
        Proceso
            ESCRIBIR("mes arranca en ", mes)
            LEER(mes)
            notas[1] := 8
            ESCRIBIR(mes, " ", notas[1])
    FIN_ACCION
  `, ["7"]);
  assert.deepEqual(salida, ["mes arranca en 1", "7 8"]);

  await assert.rejects(
    execute(`
      ACCION fuera ES
          Ambiente
              mes : 1..12
          Proceso
              LEER(mes)
      FIN_ACCION
    `, ["13"]),
    /"mes" está declarada 1\.\.12 y se le intentó guardar 13/
  );

  await assert.rejects(
    execute(`
      ACCION param ES
          Ambiente
              PROCEDIMIENTO tratar(d : 1..31) ES
                  Proceso
                      ESCRIBIR(d)
              FIN_PROCEDIMIENTO
          Proceso
              tratar(45)
      FIN_ACCION
    `),
    /"d" está declarada 1\.\.31 y se le intentó guardar 45/
  );
});

test("arreglos con límites que no arrancan en 1, incluso negativos", async () => {
  const salida = await execute(`
    ACCION limites ES
        Ambiente
            negativos : ARREGLO[-3..3] de entero
            desde_cinco : ARREGLO[5..8] de entero
            i : entero
        Proceso
            PARA i := -3 HASTA 3 HACER
                negativos[i] := i * i
            FIN_PARA
            PARA i := 5 HASTA 8 HACER
                desde_cinco[i] := i
            FIN_PARA
            ESCRIBIR(negativos[-3], " ", negativos[0], " ", desde_cinco[5], " ", desde_cinco[8])
    FIN_ACCION
  `);
  assert.deepEqual(salida, ["9 0 5 8"]);
});

test("límites al revés dan un mensaje claro, no un error interno", async () => {
  await assert.rejects(
    execute(`
      ACCION alreves ES
          Ambiente
              v : ARREGLO[10..1] de entero
          Proceso
              ESCRIBIR("hola")
      FIN_ACCION
    `),
    /están al revés: \[10\.\.1\]\. Va del menor al mayor: \[1\.\.10\]/
  );
});

test("un procedimiento no se puede usar como si devolviera un valor", async () => {
  await assert.rejects(
    execute(`
      ACCION confundido ES
          Ambiente
              r : entero
              PROCEDIMIENTO saludar ES
                  Proceso
                      ESCRIBIR("no deberia verse")
              FIN_PROCEDIMIENTO
          Proceso
              r := saludar + 1
      FIN_ACCION
    `),
    /es un PROCEDIMIENTO: no devuelve ningún valor/
  );
});

// ── Fase 2: archivos secuenciales y secuencias ─────────────────────────────

const ALUMNOS = [
  "nro_leg\tapyn\tcarrera\tfecha_nac.anio\tfecha_nac.mes\tfecha_nac.dia",
  "1042\tRojas Gonzalo\tISI\t2004\t7\t15",
  "1043\tPerez Ana\tIQ\t2003\t11\t2",
  "1044\tGomez Luis\tISI\t2005\t1\t30",
  "",
].join("\n");

const DECLARA_ALUMNO = `
        fecha = REGISTRO
            anio : 1900..9999
            mes  : 1..12
            dia  : 1..31
        FIN_REGISTRO
        alumno = REGISTRO
            nro_leg   : entero
            apyn      : AN(50)
            carrera   : ('ISI','IEM','IQ')
            fecha_nac : fecha
        FIN_REGISTRO
`;

test("recorre un archivo secuencial y procesa también el último registro", async () => {
  const salida = await execute(
    `
    ACCION listado ES
        Ambiente
${DECLARA_ALUMNO}
            arch : ARCHIVO de alumno
            alu : alumno
            cont : entero
        Proceso
            cont := 0
            ABRIR E/(arch)
            LEER(arch, alu)
            MIENTRAS NFDA(arch) HACER
                ESCRIBIR(alu.nro_leg, " ", alu.apyn, " ", alu.carrera, " ", alu.fecha_nac.dia)
                cont := cont + 1
                LEER(arch, alu)
            FIN_MIENTRAS
            ESCRIBIR("total: ", cont)
            CERRAR(arch)
    FIN_ACCION
  `,
    [],
    { "arch.tsv": ALUMNOS }
  );
  assert.deepEqual(salida, [
    "1042 Rojas Gonzalo ISI 15",
    "1043 Perez Ana IQ 2",
    "1044 Gomez Luis ISI 30",
    "total: 3",
  ]);
});

test("FDA se prende recién cuando el LEER no trajo nada (así funciona la mezcla)", async () => {
  const salida = await execute(
    `
    ACCION fin_de_archivo ES
        Ambiente
${DECLARA_ALUMNO}
            arch : ARCHIVO de alumno
            alu : alumno
        Proceso
            ABRIR E/(arch)
            LEER(arch, alu)
            LEER(arch, alu)
            LEER(arch, alu)
            SI NFDA(arch) ENTONCES
                ESCRIBIR("tras el tercero todavía hay dato: ", alu.nro_leg)
            FIN_SI
            LEER(arch, alu)
            SI FDA(arch) ENTONCES
                ESCRIBIR("el cuarto LEER no trajo nada")
            FIN_SI
            CERRAR(arch)
    FIN_ACCION
  `,
    [],
    { "arch.tsv": ALUMNOS }
  );
  assert.deepEqual(salida, ["tras el tercero todavía hay dato: 1044", "el cuarto LEER no trajo nada"]);
});

test("un archivo de salida queda escrito con su encabezado", async () => {
  const archivos: Record<string, string> = { "arch.tsv": ALUMNOS };
  await execute(
    `
    ACCION filtrar ES
        Ambiente
${DECLARA_ALUMNO}
            arch, sal : ARCHIVO de alumno
            alu : alumno
        Proceso
            ABRIR E/(arch); ABRIR /S(sal)
            LEER(arch, alu)
            MIENTRAS NFDA(arch) HACER
                SI (alu.carrera = 'ISI') ENTONCES
                    ESCRIBIR(sal, alu)
                FIN_SI
                LEER(arch, alu)
            FIN_MIENTRAS
            CERRAR(arch); CERRAR(sal)
    FIN_ACCION
  `,
    [],
    archivos
  );
  const filas = archivos["sal.tsv"].trim().split("\n");
  assert.equal(filas.length, 3);
  assert.match(filas[0], /^nro_leg\tapyn\tcarrera/);
  assert.ok(filas[1].startsWith("1042\tRojas Gonzalo\tISI"), filas[1]);
  assert.ok(filas[2].startsWith("1044\tGomez Luis\tISI"), filas[2]);
});

test("corte de control sobre dos claves da los totales de cada nivel", async () => {
  const salida = await execute(
    `
    ACCION corte ES
        Ambiente
            venta = REGISTRO
                sucursal : AN(20)
                rubro    : AN(20)
                importe  : real
            FIN_REGISTRO
            arch : ARCHIVO de venta ordenado por sucursal y rubro
            r : venta
            resg_suc, resg_rubro : AN(20)
            acum_rubro, acum_suc, total : real

            PROCEDIMIENTO corte_rubro ES
                Proceso
                    ESCRIBIR("rubro ", resg_rubro, ": ", acum_rubro)
                    acum_suc := acum_suc + acum_rubro
                    acum_rubro := 0
                    resg_rubro := r.rubro
            FIN_PROCEDIMIENTO

            PROCEDIMIENTO corte_suc ES
                Proceso
                    corte_rubro
                    ESCRIBIR("sucursal ", resg_suc, ": ", acum_suc)
                    total := total + acum_suc
                    acum_suc := 0
                    resg_suc := r.sucursal
            FIN_PROCEDIMIENTO
        Proceso
            ABRIR E/(arch)
            LEER(arch, r)
            total := 0; acum_suc := 0; acum_rubro := 0
            resg_suc := r.sucursal
            resg_rubro := r.rubro
            MIENTRAS NFDA(arch) HACER
                SI (r.sucursal <> resg_suc) ENTONCES
                    corte_suc
                SINO
                    SI (r.rubro <> resg_rubro) ENTONCES
                        corte_rubro
                    FIN_SI
                FIN_SI
                acum_rubro := acum_rubro + r.importe
                LEER(arch, r)
            FIN_MIENTRAS
            corte_suc
            ESCRIBIR("TOTAL: ", total)
            CERRAR(arch)
    FIN_ACCION
  `,
    [],
    {
      "arch.tsv": [
        "sucursal\trubro\timporte",
        "Norte\tBebidas\t100",
        "Norte\tBebidas\t50",
        "Norte\tLacteos\t80",
        "Sur\tBebidas\t200",
        "Sur\tLacteos\t150",
        "",
      ].join("\n"),
    }
  );
  assert.deepEqual(salida, [
    "rubro Bebidas: 150",
    "rubro Lacteos: 80",
    "sucursal Norte: 230",
    "rubro Bebidas: 200",
    "rubro Lacteos: 150",
    "sucursal Sur: 350",
    "TOTAL: 580",
  ]);
});

test("una secuencia se recorre con ARR y AVZ, y los barridos funcionan", async () => {
  const salida = await execute(
    `
    ACCION palabras ES
        Ambiente
            sec : SECUENCIA de caracter
            v : caracter
            pal, ora : entero
        Proceso
            pal := 0; ora := 0
            ARR(sec); AVZ(sec, v)
            MIENTRAS (v <> "#") Y NFDS(sec) HACER
                MIENTRAS (v <> ".") Y NFDS(sec) HACER
                    MIENTRAS (v = " ") HACER
                        AVZ(sec, v)
                    FIN_MIENTRAS
                    pal := pal + 1
                    MIENTRAS (v <> " ") Y (v <> ".") Y NFDS(sec) HACER
                        AVZ(sec, v)
                    FIN_MIENTRAS
                FIN_MIENTRAS
                ora := ora + 1
                AVZ(sec, v)
            FIN_MIENTRAS
            ESCRIBIR(ora, " oraciones, ", pal, " palabras")
            CERRAR(sec)
    FIN_ACCION
  `,
    [],
    { "sec.txt": "EL GATO NEGRO DUERME.LA CASA ES ROJA.#" }
  );
  assert.deepEqual(salida, ["2 oraciones, 8 palabras"]);
});

test("una secuencia de salida se crea y se escribe", async () => {
  const archivos: Record<string, string> = { "sec.txt": "abc" };
  await execute(
    `
    ACCION copiar ES
        Ambiente
            sec, sal : SECUENCIA de caracter
            v : caracter
        Proceso
            ARR(sec); AVZ(sec, v)
            CREAR(sal)
            MIENTRAS NFDS(sec) HACER
                ESCRIBIR(sal, v)
                AVZ(sec, v)
            FIN_MIENTRAS
            CERRAR(sec); CERRAR(sal)
    FIN_ACCION
  `,
    [],
    archivos
  );
  assert.equal(archivos["sal.txt"].trim(), "abc");
});

test("si faltan los datos, el mensaje dice dónde tienen que estar", async () => {
  await assert.rejects(
    execute(
      `
      ACCION sin_datos ES
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
    `,
      [],
      {}
    ),
    /No encontré los datos de "arch".*datos\/arch\.tsv.*Generar plantilla de datos/s
  );
});

test("una celda que no cuadra con el tipo dice fila y columna", async () => {
  await assert.rejects(
    execute(
      `
      ACCION celda_mala ES
          Ambiente
              reg = REGISTRO
                  clave : entero
                  precio : real
              FIN_REGISTRO
              arch : ARCHIVO de reg
              r : reg
          Proceso
              ABRIR E/(arch)
              LEER(arch, r)
              CERRAR(arch)
      FIN_ACCION
    `,
      [],
      { "arch.tsv": "clave\tprecio\n1\tabc\n" }
    ),
    /fila 2, columna "precio": se esperaba un número y dice "abc"/
  );
});

test("leer de un archivo abierto solo para escritura se explica", async () => {
  await assert.rejects(
    execute(
      `
      ACCION modo_mal ES
          Ambiente
              reg = REGISTRO
                  clave : entero
              FIN_REGISTRO
              arch : ARCHIVO de reg
              r : reg
          Proceso
              ABRIR /S(arch)
              LEER(arch, r)
      FIN_ACCION
    `,
      [],
      { "arch.tsv": "clave\n1\n" }
    ),
    /se abrió solo para escritura \(ABRIR \/S\): no se puede leer/
  );
});
