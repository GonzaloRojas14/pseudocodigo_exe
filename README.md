# Pseudocódigo AED (UTN-FRRe)

Escribí y **ejecutá** el pseudocódigo de Algoritmos y Estructuras de Datos (ISI, UTN-FRRe) directamente en VS Code: resaltado, errores marcados mientras escribís y un botón de ejecutar que corre el algoritmo en la terminal integrada, como si fuera Python.

Hecha por **Rojas Gonzalo**, estudiante de Ingeniería en Sistemas de Información de la UTN-FRRe — [@gonza._007](https://instagram.com/gonza._007)

**Es gratis y de código abierto**: el código está en [GitHub](https://github.com/GonzaloRojas14/pseudocodigo_exe), podés mirarlo, copiarlo, modificarlo y proponer cambios. Si algo del pseudocódigo de la cátedra no corre como debería, [abrí un issue](https://github.com/GonzaloRojas14/pseudocodigo_exe/issues) o escribime.

> Herramienta **no oficial**, hecha por un alumno. No está asociada ni respaldada por la UTN-FRRe.

## Qué hace

- **Ejecuta de verdad.** Botón ▶ en la barra del editor, `F5`, o "▶ Ejecutar" sobre la línea `ACCION`. `ESCRIBIR` imprime en la terminal integrada y, cuando el programa llega a un `LEER`, escribís ahí mismo y apretás Enter.
- **Marca los errores mientras escribís**, con mensajes que explican la regla de la cátedra en vez de un "syntax error" pelado: un `FIN_SI` que falta, un campo que no coincide con el registro declarado, una variable que se usa sin haberle asignado nunca un valor, un `SI ... ENTONCES:` con dos puntos de más.
- **Avisa de los errores clásicos.** Un `MIENTRAS` cuya condición ya es falsa al llegar (y por eso no entra nunca), un `PARA` cuyos límites no dan ninguna vuelta, o un ciclo infinito, que se corta solo con un mensaje que apunta a la causa.
- **Respeta la semántica de la cátedra**, no la "parecida": `/` es división real y `DIV`/`MOD` son enteras; los registros se comparan campo por campo en el orden en que fueron declarados (por eso una FECHA se declara `anio, mes, dia`); los subrangos y enumerados se validan al asignar; los parámetros van por valor salvo que lleven `var`.
- **Acepta las dos notaciones**: la moderna (`Proceso`, `SINO`, `FIN_SI`) y la de las plantillas viejas (`Algoritmo`, `Contrario`, `FinSi`), sin distinguir mayúsculas, y podés mezclarlas — los propios materiales de la cátedra las mezclan.
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

## Los datos: de dónde salen y cómo generarlos

Un `ARCHIVO`, una `SECUENCIA` o un parámetro de la `ACCION` **no tienen los datos adentro del algoritmo**. La consigna te los da por existentes ("se dispone de un archivo de alumnos", "reciba como parámetro los 50 códigos de error"), así que tienen que venir de algún lado.

Vienen de una carpeta que se llama **igual que tu archivo, pero terminada en `.datos`**, al lado:

```
mi_ejercicio.frre
mi_ejercicio.datos/
    alumnos.tsv
    texto.txt
```

**Cada archivo se llama como la VARIABLE que declaraste**, no como el tipo. Si en el Ambiente pusiste `alumnos : ARCHIVO de alumno`, el archivo de datos es `alumnos.tsv`.

### El comando que los crea por vos

No hace falta escribirlos a mano. Con el algoritmo abierto:

**Click derecho en el editor → "AED: Generar plantilla de datos"**

(o `Cmd+Shift+P` / `Ctrl+Shift+P` y buscá "AED: Generar").

El comando lee tu `Ambiente`, encuentra todos los `ARCHIVO`, `SECUENCIA` y parámetros de la `ACCION`, crea la carpeta `.datos/` y adentro un archivo por cada uno, **con los nombres de los campos ya puestos en la primera fila**. Vos solo cargás las filas debajo.

Si un archivo ya existe no lo pisa, así que podés correr el comando de nuevo cuando agregás una variable nueva.

### Los tres formatos

**`ARCHIVO de registro` → un `.tsv`**, separado por tabulaciones. Una columna por campo y una fila por registro. Los registros anidados se aplanan con punto:

```
nro_leg	apellido	fecha_nac.anio	fecha_nac.mes	fecha_nac.dia
1042	Acosta	2004	3	15
1043	Benitez	2003	11	2
```

**`SECUENCIA` → un `.txt`** con la cinta tal cual, con sus espacios y su marca de fin:

```
EL PERRO CORRE. LA CASA ES GRANDE.*
```

**Parámetros de la `ACCION` → según qué sean.** Un arreglo de registros va en `.tsv` como arriba; un arreglo de valores sueltos o un valor solo van en `.txt`, **un valor por línea**:

```
costo_hora.txt          mes.txt
1200                    3
1500
900
```

### Lo que pasa al ejecutar

Los **archivos de salida** (`ABRIR /S`, `CREAR`) se escriben en esa misma carpeta al `CERRAR`, así que después de correr el algoritmo los abrís y ves lo que generó.

Los **archivos indexados** se modifican en el lugar y **quedan guardados entre corridas**: lo que das de alta hoy sigue estando mañana, igual que un maestro de verdad. Si querés empezar de cero, borrá el `.tsv`.

Si **falta un archivo de datos**, o si una celda no cuadra con el tipo que declaraste, la extensión corta y te dice exactamente qué archivo falta, dónde tiene que estar y qué fila o columna tiene el problema — en vez de correr con valores vacíos y darte resultados equivocados sin avisar.

Y si declaraste `ARCHIVO de venta ordenado por provincia y sucursal`, **se verifica que los datos estén realmente ordenados así** antes de arrancar. Es la precondición del corte de control: si no se cumple, los totales salen partidos y es dificilísimo darse cuenta.

### FDA y FDS

Valen lo mismo que en la cátedra: se prenden cuando el último `LEER` o `AVZ` **no trajo nada**, no cuando el cursor llega al final. Eso es lo que hace que el último registro se procese y que las plantillas de mezcla y actualización funcionen tal como están escritas en los apuntes.

## Qué entra y qué todavía no

**Anda todo el lenguaje hasta archivos**: `ACCION/Ambiente/Proceso`, todos los tipos (`entero`, `real`, `caracter`, `logico`, `AN(n)`, `N(n)`, `N(e,d)`, subrangos, enumerados), registros anidados, arreglos y matrices de cualquier dimensión, `SI`/`SEGUN`/`MIENTRAS`/`REPETIR`/`PARA`, funciones y procedimientos con paso por valor y por `var`, recursividad, `ESCRIBIR`/`LEER` por pantalla y teclado, **archivos secuenciales**, **secuencias** y **archivos indexados**. Con eso corren los ejercicios de corte de control, mezcla, actualización unitaria y por lotes, procesos estadísticos y los ABM indexados.

Un archivo `INDEXADO por clave` se accede por clave, no se recorre: se carga la clave en el registro, se hace `LEER`, se pregunta `SI EXISTE` y recién ahí se opera (`ESCRIBIR` da de alta, `RE-ESCRIBIR` modifica, `ELIMINAR` da de baja física).

**Todavía no se ejecuta:** las listas con punteros (`Puntero a`, `nil`, `NUEVO`), de la unidad 4.

## Ejemplos incluidos

La extensión trae ejemplos listos para abrir y ejecutar, con sus datos ya cargados: un demo del lenguaje, corte de control de tres niveles sobre 1000 registros, un ABM indexado completo, recorrido de secuencias, y un ejercicio que recibe los datos por parámetro.
