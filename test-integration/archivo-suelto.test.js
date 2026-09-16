const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vscode = require("vscode");

const LANGUAGE_ID = "aed-pseudocodigo";

/** carpeta fuera del proyecto: simula "abrí un .frre cualquiera de tu compu" */
const afuera = fs.mkdtempSync(path.join(os.tmpdir(), "aed-suelto-"));

function escribir(nombre, contenido) {
  const destino = path.join(afuera, nombre);
  fs.writeFileSync(destino, contenido, "utf8");
  return vscode.Uri.file(destino);
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function esperarA(descripcion, condicion, timeout = 15000) {
  const limite = Date.now() + timeout;
  for (;;) {
    const valor = await condicion();
    if (valor) return valor;
    if (Date.now() > limite) assert.fail(`Se acabó el tiempo esperando: ${descripcion}`);
    await esperar(100);
  }
}

/** engancha la salida de la terminal y la devuelve como texto plano */
function capturar(pty) {
  const partes = [];
  pty.onDidWrite((texto) => partes.push(texto));
  return () => partes.join("").replace(/\x1b\[[0-9;]*m/g, "");
}

const PROGRAMA = [
  "ACCION suelto ES",
  "    Ambiente",
  "        nombre : AN(30)",
  "        n, doble : entero",
  "    Proceso",
  '        ESCRIBIR("Como te llamas?")',
  "        LEER(nombre)",
  '        ESCRIBIR("Ingrese un numero: ")',
  "        LEER(n)",
  "        doble := n * 2",
  '        ESCRIBIR(nombre, ", el doble de ", n, " es ", doble)',
  "FIN_ACCION",
  "",
].join("\n");

describe("Un archivo suelto, sin carpeta abierta", () => {
  let api;

  before(async () => {
    const extension = vscode.extensions.getExtension("gonzalo.aed-pseudocodigo");
    assert.ok(extension, "la extensión no está instalada");
    api = await extension.activate();
  });

  it("efectivamente no hay ninguna carpeta en el workspace", () => {
    assert.ok(
      !vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0,
      "este test tiene que correr sin carpeta abierta"
    );
  });

  it("un .frre de cualquier carpeta se abre como pseudocódigo AED", async () => {
    const uri = escribir("prueba.frre", PROGRAMA);
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);
    assert.equal(document.languageId, LANGUAGE_ID);
  });

  it("se ejecuta y muestra la salida, leyendo lo que se tipea", async () => {
    const uri = escribir("ejecutar.frre", PROGRAMA);
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);

    const pty = await api.ejecutar();
    assert.ok(pty, "no se creó la terminal");
    const salida = capturar(pty);
    pty.open();

    await pty.esperarPausa();
    pty.handleInput("Gonzalo\r");
    await pty.esperarPausa();
    pty.handleInput("21\r");
    await esperarA("que termine el programa", () => pty.finalizado);

    const texto = salida();
    assert.match(texto, /Como te llamas\?/);
    assert.match(texto, /Ingrese un numero:/);
    assert.match(texto, /Gonzalo, el doble de 21 es 42/, texto);
    assert.match(texto, /── fin \(\d+ ms\) ──/);
  });

  it("un archivo sin guardar (untitled) también se ejecuta", async () => {
    const document = await vscode.workspace.openTextDocument({
      language: LANGUAGE_ID,
      content: ['ACCION sin_guardar ES', '  Ambiente', '  Proceso', '    ESCRIBIR("hola desde un archivo nuevo")', 'FIN_ACCION'].join("\n"),
    });
    await vscode.window.showTextDocument(document);
    assert.ok(document.isUntitled);

    const pty = await api.ejecutar();
    assert.ok(pty, "no se creó la terminal para el archivo sin guardar");
    const salida = capturar(pty);
    pty.open();
    await esperarA("que termine", () => pty.finalizado);
    assert.match(salida(), /hola desde un archivo nuevo/);
  });

  it("un error de ejecución se muestra con su línea", async () => {
    const uri = escribir("error.frre", [
      "ACCION con_error ES",
      "    Ambiente",
      "        d : 1..31",
      "    Proceso",
      "        d := 45",
      "FIN_ACCION",
      "",
    ].join("\n"));
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);

    const pty = await api.ejecutar();
    const salida = capturar(pty);
    pty.open();
    await esperarA("que termine", () => pty.finalizado);
    assert.match(salida(), /Error de ejecución \(línea 5\): El valor 45 queda fuera del subrango/);
  });

  after(() => {
    fs.rmSync(afuera, { recursive: true, force: true });
  });
});
