# Pseudocódigo AED (UTN-FRRe)

Escribí y **ejecutá** el pseudocódigo de Algoritmos y Estructuras de Datos (ISI, UTN-FRRe) directamente en VS Code: resaltado, errores marcados mientras escribís y un botón de ejecutar que corre el algoritmo en la terminal integrada, como si fuera Python.

> Herramienta **no oficial**, hecha por un alumno de la cátedra. No está asociada ni respaldada por la UTN-FRRe.

## Qué hace

- **Ejecuta de verdad.** Botón ▶ en la barra del editor, `F5`, o "▶ Ejecutar" sobre la línea `ACCION`. `ESCRIBIR` imprime en la terminal integrada y, cuando el programa llega a un `LEER`, escribís ahí mismo y apretás Enter.
- **Marca los errores mientras escribís**, con mensajes que explican la regla de la cátedra en vez de un "syntax error" pelado: un `FIN_SI` que falta, un campo que no coincide con el registro declarado, una variable que se usa sin haberle asignado nunca un valor, un `SI ... ENTONCES:` con dos puntos de más.
- **Avisa de los errores clásicos.** Un `MIENTRAS` cuya condición ya es falsa al llegar (y por eso no entra nunca), un `PARA` cuyos límites no dan ninguna vuelta, o un ciclo infinito, que se corta solo con un mensaje que apunta a la causa.
- **Respeta la semántica de la cátedra**, no la "parecida": `/` es división real y `DIV`/`MOD` son enteras; los registros se comparan campo por campo en el orden en que fueron declarados (por eso una FECHA se declara `anio, mes, dia`); los subrangos y enumerados se validan al asignar; los parámetros van por valor salvo que lleven `var`.
- **Acepta las dos notaciones**: la moderna (`Proceso`, `SINO`, `FIN_SI`) y la de las plantillas viejas (`Algoritmo`, `Contrario`, `FinSi`), sin distinguir mayúsculas. Si mezclás las dos en un archivo, te avisa.
- **Aguanta el copiar y pegar** desde los PDF y las filminas: comillas tipográficas, el menos Unicode, `≠ ≤ ≥ × ÷`, espacios duros. Corre igual y te dice cuál es la forma correcta.

## Cómo se usa

Guardá el algoritmo con extensión `.frre` (también sirven `.pseudo` y `.aed`), abrilo y apretá ▶. No hace falta tener ninguna carpeta abierta: funciona con un archivo suelto.

Si tu ejercicio está en un `.txt` o en un archivo sin extensión, la extensión te ofrece abrirlo como pseudocódigo, o lo forzás desde la paleta con **"AED: Usar pseudocódigo AED en este archivo"**.

```
ACCION ejemplo ES
    Ambiente
        iva = 1.21
        nombre : AN(50)
        precio : real

        FUNCION con_iva(p : real) : real ES
            Proceso
                con_iva := p * iva
        FIN_FUNCION
    Proceso
        ESCRIBIR("Ingrese el articulo: ")
        LEER(nombre)
        ESCRIBIR("Ingrese el precio: ")
        LEER(precio)
        ESCRIBIR(nombre, " con IVA: ", con_iva(precio))
FIN_ACCION
```

### Atajos

| Acción | Atajo |
|---|---|
| Ejecutar | `F5`, `Ctrl+F5` / `Cmd+F5`, o `Ctrl+Alt+N` / `Cmd+Alt+N` |
| Cancelar la ejecución | `Ctrl+C` en la terminal |

## Archivos y secuencias

Un `ARCHIVO` o una `SECUENCIA` no tienen los datos adentro del algoritmo, así que van al lado, en una carpeta `<ejercicio>.datos/`:

- un `ARCHIVO de alumno` lee `alumno.tsv`: una columna por campo (los registros anidados se aplanan, `fecha_nac.anio`) y una fila por registro, separadas por tabulaciones;
- una `SECUENCIA de caracter` lee un `.txt` con la cinta tal cual, con sus espacios y sus marcas de fin.

No hay que escribirlos a mano desde cero: el comando **"AED: Generar plantilla de datos"** (click derecho en el editor) lee el `Ambiente` y crea cada archivo con sus columnas ya puestas. Los archivos de salida (`ABRIR /S`, `CREAR`) se escriben en esa misma carpeta al `CERRAR`.

`FDA` y `FDS` valen lo mismo que en la cátedra: se prenden cuando el último `LEER` o `AVZ` **no trajo nada**, que es lo que hace que el último registro se procese y que las plantillas de mezcla funcionen.

## Qué entra y qué todavía no

**Anda todo el lenguaje hasta archivos**: `ACCION/Ambiente/Proceso`, todos los tipos (`entero`, `real`, `caracter`, `logico`, `AN(n)`, `N(n)`, `N(e,d)`, subrangos, enumerados), registros anidados, arreglos y matrices, `SI`/`SEGUN`/`MIENTRAS`/`REPETIR`/`PARA`, funciones y procedimientos con paso por valor y por `var`, `ESCRIBIR`/`LEER` por pantalla y teclado, **archivos secuenciales**, **secuencias** y **archivos indexados**. Con eso corren los ejercicios de corte de control, mezcla, actualización unitaria y por lotes, y los ABM indexados.

Un archivo `INDEXADO por clave` se accede por clave, no se recorre: se carga la clave en el registro, se hace `LEER`, se pregunta `SI EXISTE` y recién ahí se opera (`ESCRIBIR` da de alta, `RE-ESCRIBIR` modifica, `ELIMINAR` da de baja física). Los cambios quedan guardados entre corridas, así que un ABM se comporta como un maestro de verdad.

**Todavía no se ejecuta:** las listas con punteros (`Puntero a`, `nil`, `NUEVO`), de la unidad 4.

## Licencia

MIT.
