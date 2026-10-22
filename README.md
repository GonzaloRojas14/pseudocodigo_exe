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
- **Ejecuta listas con punteros**: `NUEVO`, `DISPONER`, `NIL` y `*p.dato`, con listas simples, dobles y circulares, pilas y colas, escritas como las pide la cátedra. Ver [Listas con punteros](#listas-con-punteros).
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

Si los datos vienen de un script o de una planilla, también sirve un **`.csv` separado por comas** con el mismo nombre (`arch.csv`): si no está el `.tsv`, se lee ese.

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

Un **parámetro puntero** (`ACCION ELIM ES (VALOR: entero, PRIM: Puntero a NODO)`) es una lista que te dan hecha. Va en `PRIM.tsv`, **un nodo por fila en el orden de la lista**, con los campos del nodo como columnas y **sin los punteros**, que se enlazan solos: los campos que empiezan con `ant` apuntan al nodo anterior y el resto al siguiente. Si además recibe un `ULT` (`PRIM, ULT: Puntero a NODO`), no lleva archivo: apunta al último nodo de esa misma lista. Un archivo con el encabezado solo es la lista vacía. "AED: Generar plantilla de datos" crea el `PRIM.tsv` con las columnas del nodo, y ninguno para `ULT`.

**Si la consigna dice que la lista es circular**, el archivo se llama **`PRIM.circular.tsv`**. El contenido y el pseudocódigo son los mismos: lo único que cambia es que el último nodo apunta al primero (y en una doble, el `ant` del primero apunta al último). El tipo no lo dice, porque el `NODO` de una circular es igual al de una simple: lo dice la consigna, y vos se lo indicás con el nombre del archivo. Si te equivocás, el error te dice cuál va: un recorrido que espera volver al primero y cae en `NIL` sugiere `.circular.tsv`, y un `MIENTRAS p <> NIL` que no termina sobre una circular sugiere sacarle el `.circular`.

Un **registro suelto** como parámetro (`N: NODO`) va en `N.tsv` con el encabezado y una sola fila.

```
PRIM.tsv
DATO
3
5
8
```

### Lo que pasa al ejecutar

Los **archivos de salida** (`ABRIR /S`, `CREAR`) se escriben en esa misma carpeta al `CERRAR`, así que después de correr el algoritmo los abrís y ves lo que generó.

Los **archivos indexados** se modifican en el lugar y **quedan guardados entre corridas**: lo que das de alta hoy sigue estando mañana, igual que un maestro de verdad. Si querés empezar de cero, borrá el `.tsv`.

Si **falta un archivo de datos**, o si una celda no cuadra con el tipo que declaraste, la extensión corta y te dice exactamente qué archivo falta, dónde tiene que estar y qué fila o columna tiene el problema — en vez de correr con valores vacíos y darte resultados equivocados sin avisar.

Y si declaraste `ARCHIVO de venta ordenado por provincia y sucursal`, **se verifica que los datos estén realmente ordenados así** antes de arrancar. Es la precondición del corte de control: si no se cumple, los totales salen partidos y es dificilísimo darse cuenta.

### FDA y FDS

Valen lo mismo que en la cátedra: se prenden cuando el último `LEER` o `AVZ` **no trajo nada**, no cuando el cursor llega al final. Eso es lo que hace que el último registro se procese y que las plantillas de mezcla y actualización funcionen tal como están escritas en los apuntes.

## Listas con punteros

Las listas de la unidad de estructuras dinámicas se escriben y se ejecutan como las enseña la cátedra: el nodo es un `REGISTRO` con un campo que apunta al siguiente, y la lista se maneja con punteros externos (`PRIM`, `ULT`, auxiliares).

### Cómo se escriben

```
ACCION lista_ordenada ES
    Ambiente
        NODO = REGISTRO
            dato : entero
            prox : Puntero a NODO
        FIN_REGISTRO

        PRIM, p, q, a : Puntero a NODO
        valor : entero

    Proceso
        // carga ordenada: cada valor nuevo se ubica en su lugar
        PRIM := NIL
        LEER(valor)
        MIENTRAS valor <> 0 HACER
            NUEVO(p)
            *p.dato := valor
            q := PRIM
            a := NIL
            MIENTRAS (q <> NIL) Y (*q.dato < valor) HACER
                a := q
                q := *q.prox
            FIN_MIENTRAS
            SI a = NIL ENTONCES          // va primero (o la lista estaba vacía)
                *p.prox := PRIM
                PRIM := p
            SINO                         // va entre a y q
                *p.prox := q
                *a.prox := p
            FIN_SI
            LEER(valor)
        FIN_MIENTRAS

        // recorrido
        p := PRIM
        MIENTRAS p <> NIL HACER
            ESCRIBIR(*p.dato)
            p := *p.prox
        FIN_MIENTRAS

        // eliminación: se busca, se desengancha y se libera el nodo
        LEER(valor)
        q := PRIM
        a := NIL
        MIENTRAS (q <> NIL) Y (*q.dato <> valor) HACER
            a := q
            q := *q.prox
        FIN_MIENTRAS
        SI q = NIL ENTONCES
            ESCRIBIR("Error, el valor no existe")
        SINO
            SI a = NIL ENTONCES
                PRIM := *q.prox
            SINO
                *a.prox := *q.prox
            FIN_SI
            DISPONER(q)
        FIN_SI
FIN_ACCION
```

| Para | Se escribe | También se acepta |
|---|---|---|
| Declarar el puntero | `p : Puntero a NODO` | un tipo con nombre: `punt = Puntero a NODO` y `p : punt` |
| Lista vacía / fin de lista | `NIL` | `NULO` |
| Pedir un nodo | `NUEVO(p)` | |
| Liberar un nodo | `DISPONER(p)` | `BORRAR(p)` |
| El campo del nodo apuntado | `*p.dato` | `p^.dato`, `p*.dato` (la guía de TP escribe `P★.PROX`) |
| El nodo siguiente | `*(*p.prox).dato` | |
| Avanzar | `p := *p.prox` | |
| Comparar punteros | `p = q`, `p <> NIL` | solo `=` y `<>`: para ordenar se comparan los datos, `*p.dato < *q.dato` |

`*p.dato` es "el dato del nodo al que apunta `p`"; `p.dato`, sin el asterisco, es un error de notación, y la extensión lo marca. El `*` toma solo el puntero: en `*(*p.prox).dato` el paréntesis indica que primero se llega al siguiente nodo.

**Lista doble**: el nodo lleva además `ant : Puntero a NODO`, y se mantienen `PRIM` y `ULT` (el `ant` del primero y el `prox` del último valen `NIL`). Al insertar o eliminar en el medio se actualizan los cuatro punteros: `*(*p.ant).prox := *p.prox` y `*(*p.prox).ant := *p.ant`.

**Lista circular**: el último nodo apunta al primero (`*ULT.prox := PRIM`), así que no hay `NIL`; se recorre hasta volver al principio:

```
p := PRIM
REPETIR
    ESCRIBIR(*p.dato)
    p := *p.prox
HASTA QUE p = PRIM
```

**Pilas y colas** son listas con acceso restringido: una pila inserta y extrae por `PRIM` (el tope); una cola inserta por `ULT` y extrae por `PRIM`, y al vaciarse vuelve a dejar `ULT := NIL`.

También corren tal cual los algoritmos `LISTA_CIRCULAR` y `LISTA_DOBLE` de los Complementos Teóricos de la Guía de Trabajos Prácticos 2026, con su notación (`Ent.`, `Fsi`, `Fmientras`, `Freg`, `Según OP`, `OP En [1 .. 5]`, `Facción.`).

### Qué pasa al ejecutar

- `NUEVO(p)` crea el nodo en memoria y deja a `p` apuntándolo. Cada nodo tiene una dirección, que es lo que muestra `ESCRIBIR(p)` (`0x1000`, `0x1010`, …), o `NIL`.
- El puntero es la dirección del nodo, no una copia: después de `p := q` los dos apuntan al **mismo** nodo, y cambiar `*p.dato` cambia también `*q.dato`.
- La lista no está guardada en ningún lado como tal: es la cadena `PRIM → prox → … → NIL`. Los nodos existen mientras corre el algoritmo.
- `DISPONER(p)` libera el nodo. Si otro puntero lo seguía apuntando y se usa, la ejecución se corta con un aviso en vez de leer basura.
- Si la `ACCION` recibe la lista hecha (`ACCION ELIM ES (PRIM : Puntero a NODO)`), sus nodos se cargan de un archivo de datos, como se explica en [Los tres formatos](#los-tres-formatos).

### Los errores que explica

- Usar `*p.dato` cuando `p` vale `NIL`: dice que hay que preguntar `p <> NIL` antes.
- Usar un nodo después de liberarlo con `DISPONER`.
- Guardar un dato en el puntero (`p := 5`) en lugar de en el nodo (`*p.dato := 5`).
- Comparar punteros con `<` o `>`.
- Escribir `p.dato` sin el `*`, o pedir `*x` de algo que no es un puntero.
- Un recorrido que se olvida de avanzar con `p := *p.prox` (ciclo infinito).

## Qué entra y qué todavía no

**Anda todo el lenguaje hasta archivos**: `ACCION/Ambiente/Proceso`, todos los tipos (`entero`, `real`, `caracter`, `logico`, `AN(n)`, `N(n)`, `N(e,d)`, subrangos, enumerados), registros anidados, arreglos y matrices de cualquier dimensión, `SI`/`SEGUN`/`MIENTRAS`/`REPETIR`/`PARA`, funciones y procedimientos con paso por valor y por `var`, recursividad, `ESCRIBIR`/`LEER` por pantalla y teclado, **archivos secuenciales**, **secuencias** y **archivos indexados**. Con eso corren los ejercicios de corte de control, mezcla, actualización unitaria y por lotes, procesos estadísticos y los ABM indexados.

Los parámetros van por valor o por referencia (`var`), separados con `,` o `;`, y pueden ser escalares, registros, arreglos, matrices o punteros. Un tipo se puede declarar con nombre y usar en los parámetros: `vector = ARREGLO[1..N] de entero` y después `PROCEDIMIENTO Cargar(var v : vector)`.

Un archivo `INDEXADO por clave` se accede por clave, no se recorre: se carga la clave en el registro, se hace `LEER`, se pregunta `SI EXISTE` y recién ahí se opera (`ESCRIBIR` da de alta, `RE-ESCRIBIR` modifica, `ELIMINAR` da de baja física).

**Listas con punteros**: simples, dobles y circulares, pilas y colas, con `NUEVO`, `DISPONER`, `NIL` y `*p.dato`. Está todo en [Listas con punteros](#listas-con-punteros).

**Todavía no se ejecuta:**

- La coma decimal: `A := 1,3` va como `A := 1.3`.
- `ARRAY [1..n] OF INTEGER`: en la notación de la cátedra es `ARREGLO[1..n] de entero`.
- Subacciones escritas después del `FACCIÓN` del algoritmo principal, como en el corte de control de la guía: van dentro del Ambiente.

## Ejemplos incluidos

La extensión trae ejemplos listos para abrir y ejecutar, con sus datos ya cargados: un demo del lenguaje, corte de control de tres niveles sobre 1000 registros, un ABM indexado completo, recorrido de secuencias, un ejercicio que recibe los datos por parámetro, y una lista con punteros (carga ordenada, recorrido y baja).
