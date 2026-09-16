const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const vscode = require("vscode");

const LANGUAGE_ID = "aed-pseudocodigo";
const ejemplos = path.resolve(__dirname, "..", "ejemplos");

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** espera a que se cumpla una condición, o falla con un mensaje claro */
async function esperarA(descripcion, condicion, timeout = 15000) {
  const limite = Date.now() + timeout;
  for (;;) {
    const valor = await condicion();
    if (valor) return valor;
    if (Date.now() > limite) assert.fail(`Se acabó el tiempo esperando: ${descripcion}`);
    await esperar(200);
  }
}

async function abrir(nombre, contenido) {
  const destino = path.join(ejemplos, nombre);
  if (contenido !== undefined) fs.writeFileSync(destino, contenido, "utf8");
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(destino));
  await vscode.window.showTextDocument(document);
  return document;
}

describe("Integración con VS Code", () => {
  before(async () => {
    const extension = vscode.extensions.getExtension("gonzalo.aed-pseudocodigo");
    assert.ok(extension, "la extensión no está instalada en esta instancia de VS Code");
    await extension.activate();
  });

  it("los archivos .frre se abren como pseudocódigo AED", async () => {
    const document = await abrir("demo.frre");
    assert.equal(document.languageId, LANGUAGE_ID);
  });

  it("el comando de ejecutar está registrado", async () => {
    const comandos = await vscode.commands.getCommands(true);
    assert.ok(comandos.includes("aed.run"), "falta el comando aed.run");
    assert.ok(comandos.includes("aed.usarLenguaje"), "falta el comando aed.usarLenguaje");
  });

  it("aparece el botón ▶ Ejecutar sobre la ACCION (CodeLens)", async () => {
    const document = await abrir("demo.frre");
    const lentes = await esperarA("el CodeLens de ejecutar", async () => {
      const resultado = await vscode.commands.executeCommand(
        "vscode.executeCodeLensProvider",
        document.uri
      );
      return resultado && resultado.length > 0 ? resultado : undefined;
    });
    assert.ok(lentes.some((l) => l.command && l.command.title.includes("Ejecutar")));
    assert.ok(lentes.some((l) => l.command && l.command.command === "aed.run"));
  });

  it("el ejemplo no tiene errores marcados", async () => {
    const document = await abrir("demo.frre");
    await esperar(1500);
    const errores = vscode.languages
      .getDiagnostics(document.uri)
      .filter((d) => d.severity === vscode.DiagnosticSeverity.Error);
    assert.deepEqual(errores.map((d) => d.message), []);
  });

  it("un error de sintaxis se marca en el editor con su línea", async () => {
    const document = await abrir(
      "_prueba_error.frre",
      [
        "ACCION con_error ES",
        "    Ambiente",
        "        a : entero",
        "    Proceso",
        "        a := 1",
        "        SI a = 1 ENTONCES",
        '            ESCRIBIR("uno")',
        "FIN_ACCION",
        "",
      ].join("\n")
    );
    const errores = await esperarA("el diagnóstico de FIN_SI faltante", () => {
      const encontrados = vscode.languages
        .getDiagnostics(document.uri)
        .filter((d) => d.severity === vscode.DiagnosticSeverity.Error);
      return encontrados.length > 0 ? encontrados : undefined;
    });
    assert.ok(errores[0].message.includes("FIN_SI"), errores[0].message);
    assert.equal(errores[0].source, "AED");
  });

  it("ejecutar abre una terminal con el nombre de la acción", async () => {
    await abrir("demo.frre");
    const antes = vscode.window.terminals.length;
    await vscode.commands.executeCommand("aed.run");
    const terminal = await esperarA("la terminal de ejecución", () =>
      vscode.window.terminals.find((t) => t.name === "AED: demo_nucleo")
    );
    assert.ok(terminal);
    assert.ok(vscode.window.terminals.length > antes || antes > 0);
    terminal.dispose();
  });

  it("un archivo de texto plano se puede pasar a pseudocódigo AED", async () => {
    const destino = path.join(os.tmpdir(), "apunte_sin_extension");
    fs.writeFileSync(destino, "ACCION prueba ES\n Ambiente\n Proceso\n  ESCRIBIR(1)\nFIN_ACCION\n", "utf8");
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(destino));
    const editor = await vscode.window.showTextDocument(document);
    await vscode.commands.executeCommand("aed.usarLenguaje");
    await esperarA("el cambio de lenguaje", () => editor.document.languageId === LANGUAGE_ID);
    assert.equal(editor.document.languageId, LANGUAGE_ID);
  });

  after(() => {
    const temporal = path.join(ejemplos, "_prueba_error.frre");
    if (fs.existsSync(temporal)) fs.unlinkSync(temporal);
  });
});
