# Cambios

## 0.12.0

- **Se ejecutan las listas con punteros**: `Puntero a NODO`, `NIL` (o `NULO`), `NUEVO(p)`, `DISPONER(p)` (o `BORRAR(p)`, como en la teoría), y el nodo apuntado escrito `*p.dato` o `p^.dato`, anidado con paréntesis como en `*(*p.ant).prox := q`. Corren las listas simples, dobles y circulares y los cuatro casos de inserción y eliminación de las filminas.
- Errores explicados: acceder a `*p` con `p = NIL`, usar un nodo después de `DISPONER`, asignarle un dato a un puntero, comparar punteros con `<`. El checker avisa `p.dato` sin `*`, un `*` sobre algo que no es puntero, y el recorrido que se olvida de avanzar con `p := *p.prox`.
- Un parámetro `Puntero a NODO` de la ACCION recibe la lista hecha desde `<nombre>.tsv`, un nodo por fila; `ULT` apunta al último nodo de esa lista y no lleva archivo. "AED: Generar plantilla de datos" crea el `.tsv` de la lista con las columnas del nodo, sin los punteros.
- Un registro suelto como parámetro (`N: NODO`) se carga de su `.tsv`, con el encabezado y una fila. Antes se tomaba el encabezado como valor.
- Se aceptan los comentarios entre llaves `{ CASO 1 }`, los cierres con espacio (`FIN SI`, `FIN MIENTRAS`, `FIN REGISTRO`), los parámetros después del `ES` (`ACCION ELIM ES (...)`), y varios nombres con el mismo tipo en los parámetros (`PRIM, ULT: Puntero a NODO`).
- **Listas circulares por parámetro**: si la consigna dice que la lista que recibe la ACCION es circular, su archivo se llama `PRIM.circular.tsv` y el último nodo queda apuntando al primero (en una doble, también el `ant` del primero al último). El pseudocódigo no cambia. Si el nombre del archivo no coincide con cómo se recorre la lista, el error sugiere el correcto.
- `ASCII(c)` da el código de un carácter, como lo usa la guía (ejercicio 4.9).
- **Tipos con nombre para cualquier tipo**, no solo REGISTRO: `vector = ARREGLO[1..N] de entero` y después `PROCEDIMIENTO P(var v : vector)`, como en la guía (TP 6). También `punt = Puntero a NODO`, `dia = 1..31`, `nombre = AN(30)`, y un tipo con nombre que usa otro. Antes daba "no está declarado como REGISTRO".
- `Y` y `O` se pueden usar como nombres de variable (`X, Y : entero`, `P(x, y)`, `Y := 3`), como en la guía: son operadores solo entre dos operandos.
- `V` y `F` valen verdadero y falso, como en la teoría (`ES_PRIMO := V`), salvo que haya una variable con ese nombre.
- Las subacciones de la guía: `Subacción X es; ... FSubacción;` y `Acción Calc (A, B: entero): entero es ... Faccion` dentro del Ambiente.
- Una FUNCION sin parámetros avisa: según la teoría, su lista de parámetros no puede estar vacía.
- **La notación de la Guía de Trabajos Prácticos 2026**: los algoritmos de LISTA_CIRCULAR y LISTA_DOBLE de los Complementos Teóricos corren transcriptos tal cual (salvo tres errores de la propia guía que la extensión detecta: `ANT` sin declarar, el tipo `punt` y un `Fsi` que falta). Se aceptan `Ent.`, `Fsi`, `Fmientras`, `Fpara`, `Fsegún`, `Freg`, `Facción.`, `Según X` sin `HACER`, conjuntos con rangos como `OP En [1 .. 5]`, y el nodo apuntado escrito después del puntero, `P*.PROX` (en la guía, `P★.PROX`; el ★ pegado del PDF se acepta con un aviso).
- **El dialecto del Anexo de las actividades formativas**: `fin_reg`, parámetros separados por `;`, `Procedimiento X(...);` sin `ES`, y `ABRIR(arch)` sin modo, que es lectura.
- Un `ARCHIVO` puede leer sus datos de un `.csv` separado por comas si no está el `.tsv`.
- Todas las cargas y operaciones de listas de la teoría (insertar al inicio, al final y en orden, eliminar por valor, pilas y colas) corren copiadas textuales del apunte, y quedan verificadas con un test.
- Ejemplo nuevo: `listas.frre`.

## 0.11.1

- La página de la extensión explica en detalle de dónde salen los datos, el comando que genera las plantillas y los tres formatos, con ejemplos.
- Decía que mezclar las dos notaciones daba un aviso: eso dejó de ser cierto en la 0.9.0.

## 0.11.0

- **La ACCION puede recibir datos externos por parámetro**, como los plantea la cátedra: "reciba como parámetro los 50 códigos de error", "se cuenta con un vector de 6 posiciones". Antes se podía escribir pero los valores llegaban en cero. Ahora se cargan desde la carpeta de datos: un arreglo de registros en `.tsv` con encabezado, un arreglo de escalares o un valor suelto en `.txt`, un valor por línea.
- "AED: Generar plantilla de datos" crea también el archivo de cada parámetro.
- Si el archivo de un parámetro falta, o trae más o menos elementos que el arreglo declarado, se explica en vez de seguir con datos vacíos.

## 0.10.0

- `TRUNC` y `REDOND` se pueden usar, como `ABSO`. Aparecen en las consignas del TP1.
- Una constante numérica sirve como límite de arreglo: `N = 50` y después `V : ARREGLO[1..N] de entero`. Antes solo se aceptaban números escritos a mano.
- `EN` acepta el conjunto escrito en el lugar: `SI (c EN ('a','e','i','o','u'))`. Ya andaba contra un texto y contra un arreglo.

## 0.9.1

- `arr` y `avz` dejan de ser palabras reservadas fijas: ahora son la primitiva de secuencias solo si vienen con paréntesis. `arr : arreglo de [1..200] de libro` fallaba con errores que no decían nada del problema real.

## 0.9.0

- Se aceptan las dos notaciones de la cátedra sin avisar nada: `FIN_SI` y `FinSi`, `Proceso` y `Algoritmo`. Mezclarlas tampoco es error — los propios materiales de la cátedra las mezclan.
- Las claves de `ordenado por` que son un REGISTRO se comparan campo por campo, en el orden de declaración. Antes se comparaban como texto, así que un archivo ordenado por fecha se rechazaba porque el día 17 le quedaba antes que el 3.

## 0.8.1

- Leer un archivo dentro de un registro de otro tipo ahora apunta a la declaración del archivo, en vez de fallar mucho después con un campo que no existe.

## 0.8.0

- Se verifica la precondición del corte de control: si el archivo está declarado `ordenado por ...` y los datos no lo están, se avisa con la fila exacta que rompe el orden, en vez de dejar que salgan totales partidos.
- Los reales ya no muestran el ruido binario de sumar muchos valores (`785960.3900000001` → `785960.39`).
- Ejemplo nuevo de 1000 registros: corte de control de tres niveles, con sus datos ordenados.
- `npm run aed` para correr pseudocódigo desde la terminal, sin abrir VS Code.

## 0.7.0

- **Los archivos indexados se ejecutan**: `SI EXISTE`, alta con `ESCRIBIR`, `RE-ESCRIBIR` y `ELIMINAR`, con el maestro persistiendo entre corridas.
- Las trampas del indexado se explican en vez de fallar raro: `RE-ESCRIBIR` sin `LEER` previo, recorrerlo con `NFDA`, `SI EXISTE` antes de leer, o un alta con clave repetida.
- `ARRANCAR` y `AVANZAR` se aceptan como sinónimos de `ARR` y `AVZ`, avisando la forma abreviada.
- Un `SEGUN` con comparaciones en las ramas explica que eso va con una cascada de `SI ... SINO`.
- Ejemplo nuevo: ABM indexado completo, con la plantilla de la cátedra.

## 0.6.0

- **Los archivos secuenciales y las secuencias se ejecutan.** Con eso andan los ejercicios de corte de control, mezcla y actualización, que no necesitan nada más del lenguaje.
- Los datos van en `<ejercicio>.datos/`: un `.tsv` por archivo de registros y un `.txt` por secuencia.
- Comando nuevo **"AED: Generar plantilla de datos"**: lee el Ambiente y crea cada archivo con sus columnas.
- Los archivos de salida (`ABRIR /S`, `CREAR`) se escriben al `CERRAR`, y la terminal dice dónde quedaron.
- Si una celda no cuadra con el tipo declarado, el error dice fila y columna.
- Dos ejemplos nuevos que vienen con la extensión: corte de control y recorrido de secuencia, con sus datos.

## 0.5.1

- Usar un procedimiento como si devolviera un valor ahora se marca al escribir, y en ejecución ya no se ejecuta antes de avisar.
- Nombrar una función sin sus paréntesis se explica en vez de decir que no está declarada.
- Los límites de arreglo al revés dan un mensaje claro en lugar de un error interno.
- Los errores de rango nombran la variable o la componente: *"notas[2]" está declarada 1..10*.

## 0.5.0

- Los errores dicen dónde quedó abierto el bloque: "Falta FIN_SI: el SI que empieza en la línea 12 quedó sin cerrar", con un enlace clickeable a esa línea.
- Distingue un cierre que falta de un cierre que sobra.
- Sugiere el nombre parecido cuando hay un typo, en variables, campos, procedimientos, funciones, tipos y palabras clave: *¿Quisiste escribir "centena"?*
- Los errores de ejecución nombran la variable: *"cantidad" es entera y se le intentó guardar 3.5*.
- Los mensajes vagos ahora enumeran qué sí es válido en ese lugar.
- Un error de cierre que es consecuencia de otro error anterior ya no se muestra: se arregla el primero y listo.

## 0.4.0

- Avisa cuando un `MIENTRAS` no termina nunca porque nada dentro del ciclo puede cambiar su condición.
- Avisa del acumulador que nunca arranca: un `s := s + b` sin el `s := 0` previo.
- Página de presentación, ícono y licencia, para poder publicar en el Marketplace.

## 0.3.0

- Avisa cuando un `MIENTRAS` no puede entrar ni una vez porque su condición ya es falsa al llegar, y cuando un `PARA` no da ninguna vuelta.
- Acepta código pegado desde los PDF y las filminas: comillas tipográficas, menos Unicode, `≠ ≤ ≥ × ÷`, espacios duros y BOM.
- Marca visible en la terminal cuando el programa está esperando que escribas.

## 0.2.0

- Botón ▶ en la barra del editor, menú contextual, CodeLens sobre la `ACCION` y atajos `F5` / `Cmd+F5` / `Cmd+Alt+N`.
- Ejecuta archivos sueltos, sin necesidad de tener una carpeta abierta, y también archivos sin guardar.
- Detecta el pseudocódigo en archivos `.txt` o sin extensión y ofrece abrirlos con el lenguaje.
- Arreglos: las reglas de indentación no funcionaban, la terminal podía quedar vacía al ejecutar, y las flechas del teclado ensuciaban lo que se escribía en un `LEER`.

## 0.1.0

- Primera versión: resaltado, diagnósticos con las reglas de la cátedra y ejecución del núcleo del lenguaje en la terminal integrada.
