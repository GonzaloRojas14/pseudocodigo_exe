# Cambios

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
