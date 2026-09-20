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
  fs.mkdirSync(path.dirname(destino), { recursive: true });
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
    assert.match(
      salida(),
      /Error de ejecución \(línea 5\): "d" está declarada 1\.\.31 y se le intentó guardar 45\./
    );
  });

  after(() => {
    fs.rmSync(afuera, { recursive: true, force: true });
  });
});

describe("Archivos y secuencias en VS Code de verdad", () => {
  let api;

  before(async () => {
    const extension = vscode.extensions.getExtension("gonzalo.aed-pseudocodigo");
    api = await extension.activate();
  });

  const PROGRAMA_ARCHIVO = [
    "ACCION ventas ES",
    "    Ambiente",
    "        venta = REGISTRO",
    "            sucursal : AN(20)",
    "            importe  : real",
    "        FIN_REGISTRO",
    "        arch : ARCHIVO de venta",
    "        r : venta",
    "        total : real",
    "    Proceso",
    "        total := 0",
    "        ABRIR E/(arch)",
    "        LEER(arch, r)",
    "        MIENTRAS NFDA(arch) HACER",
    "            total := total + r.importe",
    "            LEER(arch, r)",
    "        FIN_MIENTRAS",
    '        ESCRIBIR("total: ", total)',
    "        CERRAR(arch)",
    "FIN_ACCION",
    "",
  ].join("\n");

  it("el comando genera la plantilla de datos con las columnas del registro", async () => {
    const uri = escribir("ventas.frre", PROGRAMA_ARCHIVO);
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);

    await vscode.commands.executeCommand("aed.generarDatos");

    const esperado = path.join(afuera, "ventas.datos", "arch.tsv");
    await esperarA("que se cree el archivo de datos", () => fs.existsSync(esperado));
    assert.equal(fs.readFileSync(esperado, "utf8").trim(), "sucursal\timporte");
  });

  it("y con los datos cargados, el algoritmo los lee y suma", async () => {
    const uri = escribir("ventas2.frre", PROGRAMA_ARCHIVO);
    fs.mkdirSync(path.join(afuera, "ventas2.datos"), { recursive: true });
    fs.writeFileSync(
      path.join(afuera, "ventas2.datos", "arch.tsv"),
      "sucursal\timporte\nNorte\t100\nSur\t250.5\n",
      "utf8"
    );

    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);

    const pty = await api.ejecutar();
    const salida = capturar(pty);
    pty.open();
    await esperarA("que termine", () => pty.finalizado);
    assert.match(salida(), /total: 350\.5/, salida());
  });

  it("si faltan los datos, la terminal dice dónde tienen que estar", async () => {
    const uri = escribir("sin_datos.frre", PROGRAMA_ARCHIVO);
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document);

    const pty = await api.ejecutar();
    const salida = capturar(pty);
    pty.open();
    await esperarA("que termine", () => pty.finalizado);
    assert.match(salida(), /No encontré los datos de "arch"/, salida());
    assert.match(salida(), /Generar plantilla de datos/);
  });
});
