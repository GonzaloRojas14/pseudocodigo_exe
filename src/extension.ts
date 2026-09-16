import * as vscode from "vscode";
import type { Program } from "./ast";
import { check } from "./checker";
import type { Diagnostic } from "./diagnostics";
import { CancelledError, RuntimeError, run, type Host } from "./interpreter";
import { parse } from "./parser";

const LANGUAGE_ID = "aed-pseudocodigo";

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection(LANGUAGE_ID);
  context.subscriptions.push(diagnostics);

  const timers = new Map<string, NodeJS.Timeout>();
  const refresh = (document: vscode.TextDocument, delay = 0): void => {
    if (document.languageId !== LANGUAGE_ID) return;
    const key = document.uri.toString();
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        diagnostics.set(document.uri, analyze(document.getText()).diagnostics.map(toVsDiagnostic));
      }, delay)
    );
  };

  for (const document of vscode.workspace.textDocuments) refresh(document);

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((document) => refresh(document)),
    vscode.workspace.onDidChangeTextDocument((event) => refresh(event.document, 350)),
    vscode.workspace.onDidCloseTextDocument((document) => diagnostics.delete(document.uri)),
    vscode.languages.registerCodeLensProvider(
      { language: LANGUAGE_ID },
      {
        provideCodeLenses(document) {
          const lenses: vscode.CodeLens[] = [];
          for (let line = 0; line < document.lineCount; line++) {
            if (/^\s*acci[oó]n\b/i.test(document.lineAt(line).text)) {
              lenses.push(
                new vscode.CodeLens(new vscode.Range(line, 0, line, 0), {
                  title: "▶ Ejecutar",
                  command: "aed.run",
                })
              );
            }
          }
          return lenses;
        },
      }
    ),
    vscode.commands.registerCommand("aed.run", (uri?: vscode.Uri) => runDocument(diagnostics, uri)),
    vscode.commands.registerCommand("aed.usarLenguaje", () => usarLenguaje()),
    vscode.workspace.onDidOpenTextDocument((document) => ofrecerLenguaje(document))
  );

  for (const document of vscode.workspace.textDocuments) void ofrecerLenguaje(document);
}

/** los apuntes suelen ser .txt o sin extensión: ofrecemos cambiarles el lenguaje */
const yaPreguntado = new Set<string>();

async function ofrecerLenguaje(document: vscode.TextDocument): Promise<void> {
  if (document.languageId === LANGUAGE_ID) return;
  if (document.languageId !== "plaintext" || document.uri.scheme !== "file") return;
  const key = document.uri.toString();
  if (yaPreguntado.has(key)) return;

  const head = document.getText().slice(0, 4000);
  if (!/\bACCI[OÓ]N\b[\s\S]{0,200}\bES\b/i.test(head) || !/\bFIN_ACCI[OÓ]N|FinAccion/i.test(head)) return;

  yaPreguntado.add(key);
  const answer = await vscode.window.showInformationMessage(
    "Esto parece pseudocódigo AED. ¿Lo abro como pseudocódigo para tener resaltado, errores y botón de ejecutar?",
    "Sí"
  );
  if (answer === "Sí") await vscode.languages.setTextDocumentLanguage(document, LANGUAGE_ID);
}

async function usarLenguaje(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage("Abrí primero el archivo de pseudocódigo.");
    return;
  }
  await vscode.languages.setTextDocumentLanguage(editor.document, LANGUAGE_ID);
}

export function deactivate(): void {
  // nada que limpiar: la terminal se cierra sola
}

function analyze(source: string): { program?: Program; diagnostics: Diagnostic[] } {
  const parsed = parse(source);
  if (!parsed.program) return parsed;
  return {
    program: parsed.program,
    diagnostics: [...parsed.diagnostics, ...check(parsed.program)].sort((a, b) => a.pos.offset - b.pos.offset),
  };
}

function toVsDiagnostic(item: Diagnostic): vscode.Diagnostic {
  const line = Math.max(0, item.pos.line - 1);
  const col = Math.max(0, item.pos.col - 1);
  const range = new vscode.Range(line, col, line, col + Math.max(1, item.pos.length));
  const severity =
    item.severity === "error"
      ? vscode.DiagnosticSeverity.Error
      : item.severity === "warning"
        ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Information;
  const diagnostic = new vscode.Diagnostic(range, item.message, severity);
  diagnostic.source = "AED";
  return diagnostic;
}

/** una terminal por archivo: volver a ejecutar reemplaza la anterior, como hace Python */
const terminales = new Map<string, vscode.Terminal>();

async function runDocument(collection: vscode.DiagnosticCollection, uri?: vscode.Uri): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  const document = uri
    ? await vscode.workspace.openTextDocument(uri)
    : editor?.document;

  if (!document) {
    void vscode.window.showWarningMessage("Abrí un archivo de pseudocódigo para ejecutarlo.");
    return;
  }
  if (document.isDirty) await document.save();

  const { program, diagnostics } = analyze(document.getText());
  collection.set(document.uri, diagnostics.map(toVsDiagnostic));

  const errors = diagnostics.filter((d) => d.severity === "error");
  if (!program || errors.length > 0) {
    const first = errors[0];
    const message = first
      ? `No se puede ejecutar: ${first.message} (línea ${first.pos.line})`
      : "No se puede ejecutar: el algoritmo tiene errores de sintaxis.";
    const action = await vscode.window.showErrorMessage(message, "Ir al error");
    if (action && first) {
      const target = editor?.document === document ? editor : await vscode.window.showTextDocument(document);
      const position = new vscode.Position(Math.max(0, first.pos.line - 1), Math.max(0, first.pos.col - 1));
      target.selection = new vscode.Selection(position, position);
      target.revealRange(new vscode.Range(position, position));
    }
    return;
  }

  const key = document.uri.toString();
  terminales.get(key)?.dispose();

  const pty = new PseudocodeTerminal(program);
  const terminal = vscode.window.createTerminal({ name: `AED: ${program.name}`, pty });
  terminales.set(key, terminal);
  terminal.show();
}

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";

class PseudocodeTerminal implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>();
  private closeEmitter = new vscode.EventEmitter<number>();
  readonly onDidWrite = this.writeEmitter.event;
  readonly onDidClose = this.closeEmitter.event;

  private buffer = "";
  private pendingRead?: (line: string) => void;
  private cancelled = false;

  constructor(private program: Program) {}

  open(): void {
    this.line(`${DIM}── ACCION ${this.program.name} ──${RESET}`);
    void this.execute();
  }

  close(): void {
    this.cancelled = true;
    this.pendingRead?.("");
  }

  handleInput(data: string): void {
    for (const char of data) {
      if (char === "\x03") {
        this.cancelled = true;
        this.line(`${YELLOW}^C — ejecución cancelada${RESET}`);
        this.pendingRead?.("");
        this.pendingRead = undefined;
        continue;
      }
      if (char === "\r") {
        const line = this.buffer;
        this.buffer = "";
        this.writeEmitter.fire("\r\n");
        const resolve = this.pendingRead;
        this.pendingRead = undefined;
        resolve?.(line);
        continue;
      }
      if (char === "\x7f") {
        if (this.buffer.length > 0) {
          this.buffer = this.buffer.slice(0, -1);
          this.writeEmitter.fire("\b \b");
        }
        continue;
      }
      if (char >= " ") {
        this.buffer += char;
        this.writeEmitter.fire(char);
      }
    }
  }

  private line(text: string): void {
    this.writeEmitter.fire(`${text.replace(/\n/g, "\r\n")}\r\n`);
  }

  private async execute(): Promise<void> {
    const host: Host = {
      write: (text) => this.line(text),
      readLine: () =>
        new Promise<string>((resolve) => {
          if (this.cancelled) {
            resolve("");
            return;
          }
          this.pendingRead = resolve;
        }),
      isCancelled: () => this.cancelled,
    };

    const started = Date.now();
    try {
      await run(this.program, host);
      this.line(`${DIM}── fin (${Date.now() - started} ms) ──${RESET}`);
    } catch (err) {
      if (err instanceof CancelledError) {
        this.line(`${YELLOW}Ejecución cancelada.${RESET}`);
      } else if (err instanceof RuntimeError) {
        const where = err.pos ? ` (línea ${err.pos.line})` : "";
        this.line(`${RED}Error de ejecución${where}: ${err.message}${RESET}`);
      } else {
        this.line(`${RED}Error inesperado: ${err instanceof Error ? err.message : String(err)}${RESET}`);
      }
    }
    this.line(`${DIM}(cerrá esta terminal cuando quieras)${RESET}`);
  }
}
