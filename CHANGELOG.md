# Cambios

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
