import assert from "node:assert/strict";
import { test } from "node:test";
import { errors, warnings } from "./helpers";

test("variable no declarada", () => {
  const source = `
    ACCION sin_declarar ES
        Ambiente
            a : entero
        Proceso
            a := b + 1
    FIN_ACCION
  `;
  assert.ok(errors(source).some((m) => m.includes('"b" no está declarada')));
});

test("campo que no coincide con la declaración del registro (errores-y-trampas #10)", () => {
  const source = `
    ACCION campos ES
        Ambiente
            libro = REGISTRO
                cant_punt : entero
            FIN_REGISTRO
            l : libro
        Proceso
            l.cant_puntos := 3
    FIN_ACCION
  `;
  const found = errors(source);
  assert.ok(found.some((m) => m.includes("cant_puntos") && m.includes("cant_punt")), found.join(" | "));
});

test("cantidad de parámetros que no coincide", () => {
  const source = `
    ACCION parametros ES
        Ambiente
            PROCEDIMIENTO modif(tipo : caracter) ES
                Proceso
                    ESCRIBIR(tipo)
            FIN_PROCEDIMIENTO
        Proceso
            modif
    FIN_ACCION
  `;
  assert.ok(errors(source).some((m) => m.includes("espera 1 parámetro")));
});

test("no se le puede asignar a una constante", () => {
  const source = `
    ACCION constante ES
        Ambiente
            HV = 99999999
        Proceso
            HV := 1
    FIN_ACCION
  `;
  assert.ok(errors(source).some((m) => m.includes("constante")));
});

test("índice literal fuera de los límites declarados", () => {
  const source = `
    ACCION indices ES
        Ambiente
            V : ARREGLO[1..10] de entero
        Proceso
            V[11] := 1
    FIN_ACCION
  `;
  assert.ok(errors(source).some((m) => m.includes("fuera del rango")));
});

test("cantidad de índices distinta a las dimensiones", () => {
  const source = `
    ACCION dimensiones ES
        Ambiente
            M : ARREGLO[1..3, 1..3] de entero
        Proceso
            M[2] := 1
    FIN_ACCION
  `;
  assert.ok(errors(source).some((m) => m.includes("dimensión")));
});

test("una función que nunca asigna su nombre no devuelve nada", () => {
  const source = `
    ACCION funcion_muda ES
        Ambiente
            FUNCION doble(x : entero) : entero ES
                Proceso
                    ESCRIBIR(x * 2)
            FIN_FUNCION
        Proceso
            ESCRIBIR(doble(2))
    FIN_ACCION
  `;
  assert.ok(warnings(source).some((m) => m.includes("nunca asigna su resultado")));
});

test("variable usada en un cálculo sin haberle asignado nunca (errores-y-trampas #14)", () => {
  const source = `
    ACCION sin_valor ES
        Ambiente
            c, p : real
        Proceso
            p := c * 2
            ESCRIBIR(p)
    FIN_ACCION
  `;
  assert.ok(warnings(source).some((m) => m.includes("nunca se le asigna valor")));
});

test("un tipo de registro inexistente se marca", () => {
  const source = `
    ACCION tipo_faltante ES
        Ambiente
            r : persona
        Proceso
            ESCRIBIR("hola")
    FIN_ACCION
  `;
  assert.ok(errors(source).some((m) => m.includes("no está declarado como REGISTRO")));
});

test("el esquema de corte de control pasa el checker sin errores", () => {
  const source = `
    ACCION archivo_corte ES
        Ambiente
            reg = REGISTRO
                clave1 : AN(50)
                clave2 : entero
                campo1 : entero
            FIN_REGISTRO

            arch : ARCHIVO de reg ordenado por clave1 y clave2
            r : reg
            resg_clave1 : AN(50)
            resg_clave2 : entero
            acum2, acum1, acumT : entero

            PROCEDIMIENTO inicializar ES
                Proceso
                    acumT := 0; acum1 := 0; acum2 := 0
                    resg_clave1 := r.clave1
                    resg_clave2 := r.clave2
            FIN_PROCEDIMIENTO

            PROCEDIMIENTO tratar_registro ES
                Proceso
                    acum2 := acum2 + r.campo1
            FIN_PROCEDIMIENTO

            PROCEDIMIENTO corte_clave2 ES
                Proceso
                    ESCRIBIR("Total de ", resg_clave2, ": ", acum2)
                    acum1 := acum1 + acum2
                    acum2 := 0
                    resg_clave2 := r.clave2
            FIN_PROCEDIMIENTO

            PROCEDIMIENTO corte_clave1 ES
                Proceso
                    corte_clave2
                    ESCRIBIR("Total de ", resg_clave1, ": ", acum1)
                    acumT := acumT + acum1
                    acum1 := 0
                    resg_clave1 := r.clave1
            FIN_PROCEDIMIENTO

            PROCEDIMIENTO tratar_corte ES
                Proceso
                    SI (r.clave1 <> resg_clave1) ENTONCES
                        corte_clave1
                    SINO
                        SI (r.clave2 <> resg_clave2) ENTONCES
                            corte_clave2
                        FIN_SI
                    FIN_SI
            FIN_PROCEDIMIENTO

        Proceso
            ABRIR E/(arch)
            LEER(arch, r)
            inicializar
            MIENTRAS NFDA(arch) HACER
                tratar_corte
                tratar_registro
                LEER(arch, r)
            FIN_MIENTRAS
            corte_clave1
            ESCRIBIR("Total general: ", acumT)
            CERRAR(arch)
    FIN_ACCION
  `;
  assert.deepEqual(errors(source), []);
});

test("avisa cuando el MIENTRAS no puede entrar ni una vez (condición al revés)", () => {
  const source = `
    ACCION ejemplo ES
        AMBIENTE
            contador : ENTERO
        PROCESO
            contador := 0
            MIENTRAS contador > 100 HACER
                contador := contador + 1
            FIN_MIENTRAS
            ESCRIBIR(contador)
    FIN_ACCION
  `;
  const avisos = warnings(source);
  assert.ok(avisos.some((m) => m.includes("no se ejecuta ni una vez")), avisos.join(" | "));
  assert.ok(avisos.some((m) => m.includes("contador > 100")));
});

test("no avisa cuando el ciclo sí puede entrar", () => {
  const source = `
    ACCION bien ES
        AMBIENTE
            contador : ENTERO
        PROCESO
            contador := 0
            MIENTRAS contador < 100 HACER
                contador := contador + 1
            FIN_MIENTRAS
    FIN_ACCION
  `;
  assert.ok(!warnings(source).some((m) => m.includes("no se ejecuta ni una vez")), warnings(source).join(" | "));
});

test("no se mete a adivinar si el valor viene de un LEER", () => {
  const source = `
    ACCION con_lectura ES
        AMBIENTE
            n : entero
        PROCESO
            n := 0
            LEER(n)
            MIENTRAS n > 100 HACER
                n := n - 1
            FIN_MIENTRAS
    FIN_ACCION
  `;
  assert.ok(!warnings(source).some((m) => m.includes("no se ejecuta ni una vez")));
});

test("avisa cuando el PARA no da ninguna vuelta", () => {
  const source = `
    ACCION para_vacio ES
        AMBIENTE
        PROCESO
            PARA i := 10 HASTA 1 HACER
                ESCRIBIR(i)
            FIN_PARA
    FIN_ACCION
  `;
  const avisos = warnings(source);
  assert.ok(avisos.some((m) => m.includes("PARA no se ejecuta ni una vez")), avisos.join(" | "));
  assert.ok(avisos.some((m) => m.includes("-1")));
});

test("el PARA hacia atrás con incremento negativo no avisa nada", () => {
  const source = `
    ACCION para_atras ES
        AMBIENTE
        PROCESO
            PARA i := 10 HASTA 1, -1 HACER
                ESCRIBIR(i)
            FIN_PARA
    FIN_ACCION
  `;
  assert.ok(!warnings(source).some((m) => m.includes("no se ejecuta ni una vez")));
});

test("avisa cuando nada dentro del ciclo puede cambiar la condición", () => {
  const source = `
    ACCION ejemplo ES
        AMBIENTE
            a : LOGICO
            b, s : ENTERO
        PROCESO
            a := VERDADERO
            s := 0
            MIENTRAS a = VERDADERO HACER
                LEER(b)
                s := s + b
            FIN_MIENTRAS
    FIN_ACCION
  `;
  const avisos = warnings(source);
  assert.ok(avisos.some((m) => m.includes("no termina nunca")), avisos.join(" | "));
  assert.ok(avisos.some((m) => m.includes('"a"')));
});

test("no avisa si adentro del ciclo se apaga el flag", () => {
  const source = `
    ACCION con_salida ES
        AMBIENTE
            a : LOGICO
            b : ENTERO
        PROCESO
            a := VERDADERO
            MIENTRAS a = VERDADERO HACER
                LEER(b)
                SI (b = 0) ENTONCES
                    a := FALSO
                FIN_SI
            FIN_MIENTRAS
    FIN_ACCION
  `;
  assert.ok(!warnings(source).some((m) => m.includes("no termina nunca")), warnings(source).join(" | "));
});

test("no opina sobre ciclos de archivo o secuencia, que avanzan por afuera", () => {
  const source = `
    ACCION recorrido ES
        Ambiente
            reg = REGISTRO
                clave : entero
            FIN_REGISTRO
            arch : ARCHIVO de reg
            r : reg
        Proceso
            ABRIR E/(arch)
            LEER(arch, r)
            MIENTRAS NFDA(arch) HACER
                LEER(arch, r)
            FIN_MIENTRAS
            CERRAR(arch)
    FIN_ACCION
  `;
  assert.ok(!warnings(source).some((m) => m.includes("no termina nunca")), warnings(source).join(" | "));
});

test("avisa del acumulador que nunca arranca en cero", () => {
  const source = `
    ACCION acumular ES
        AMBIENTE
            s, b : ENTERO
        PROCESO
            PARA i := 1 HASTA 3 HACER
                LEER(b)
                s := s + b
            FIN_PARA
            ESCRIBIR(s)
    FIN_ACCION
  `;
  const avisos = warnings(source);
  assert.ok(avisos.some((m) => m.includes("nunca se le dio un valor inicial") && m.includes("s := 0")), avisos.join(" | "));
});

test("un acumulador inicializado en otra subacción no se marca", () => {
  const source = `
    ACCION con_inicializar ES
        Ambiente
            acum : entero

            PROCEDIMIENTO inicializar ES
                Proceso
                    acum := 0
            FIN_PROCEDIMIENTO

            PROCEDIMIENTO tratar ES
                Proceso
                    acum := acum + 1
            FIN_PROCEDIMIENTO
        Proceso
            inicializar
            tratar
            ESCRIBIR(acum)
    FIN_ACCION
  `;
  assert.ok(!warnings(source).some((m) => m.includes("nunca se le dio un valor inicial")), warnings(source).join(" | "));
});

test("sugiere el nombre parecido cuando hay un typo", () => {
  const source = `
    ACCION typos ES
        Ambiente
            alumno = REGISTRO
                nro_legajo : entero
                cant_punt : entero
            FIN_REGISTRO
            a : alumno
            centena : entero

            PROCEDIMIENTO tratar_registro ES
                Proceso
                    centena := 0
            FIN_PROCEDIMIENTO
        Proceso
            centena := 0
            a.cant_puntos := 3
            centera := 5
            tratar_regsitro
    FIN_ACCION
  `;
  const encontrados = errors(source);
  assert.ok(encontrados.some((m) => m.includes('¿Quisiste escribir "cant_punt"?')), encontrados.join(" | "));
  assert.ok(encontrados.some((m) => m.includes('¿Quisiste escribir "centena"?')));
  assert.ok(encontrados.some((m) => m.includes('¿Quisiste escribir "tratar_registro"?')));
});

test("cuando no hay nada parecido, dice cómo declararla", () => {
  const source = `
    ACCION sin_parecido ES
        Ambiente
            a : entero
        Proceso
            a := xyzzy + 1
    FIN_ACCION
  `;
  const encontrados = errors(source);
  assert.ok(encontrados.some((m) => m.includes("Agregala arriba, en el Ambiente")), encontrados.join(" | "));
});

test("una variable usada como procedimiento lo explica", () => {
  const source = `
    ACCION confundido ES
        Ambiente
            contador : entero
        Proceso
            contador := 0
            contador
    FIN_ACCION
  `;
  assert.ok(errors(source).some((m) => m.includes("es una variable, no un procedimiento")));
});

test("distingue función de procedimiento al usarlos mal", () => {
  const source = `
    ACCION confundir ES
        Ambiente
            r : entero

            FUNCION doble(x : entero) : entero ES
                Proceso
                    doble := x * 2
            FIN_FUNCION

            PROCEDIMIENTO saludar ES
                Proceso
                    ESCRIBIR("hola")
            FIN_PROCEDIMIENTO
        Proceso
            r := saludar + 1
            doble(3)
            r := doble
    FIN_ACCION
  `;
  const encontrados = errors(source);
  assert.ok(encontrados.some((m) => m.includes("es un PROCEDIMIENTO")), encontrados.join(" | "));
  assert.ok(encontrados.some((m) => m.includes("es una FUNCION") && m.includes("doble(x)")));
  assert.ok(warnings(source).some((m) => m.includes("no como instrucción suelta")));
});
