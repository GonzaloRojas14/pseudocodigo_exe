const fs = require("node:fs");
const path = require("node:path");
const oniguruma = require("vscode-oniguruma");
const textmate = require("vscode-textmate");

const ROOT = "/Users/gonzalo/Desktop/Estudios/Algoritmos/aed-vscode";
const wasm = fs.readFileSync(path.join(ROOT, "node_modules/vscode-oniguruma/release/onig.wasm"));

const vscodeOnigurumaLib = oniguruma.loadWASM(wasm.buffer).then(() => ({
  createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
  createOnigString: (s) => new oniguruma.OnigString(s),
}));

const registry = new textmate.Registry({
  onigLib: vscodeOnigurumaLib,
  loadGrammar: async () =>
    textmate.parseRawGrammar(
      fs.readFileSync(path.join(ROOT, "syntaxes/aed.tmLanguage.json"), "utf8"),
      "aed.tmLanguage.json"
    ),
});

/** resume el scope principal de cada token */
function scopeCorto(scopes) {
  const last = scopes[scopes.length - 1];
  return last === "source.aed" ? "—" : last.replace(/\.aed$/, "");
}

(async () => {
  const grammar = await registry.loadGrammar("source.aed");
  const file = process.argv[2];
  const lines = fs.readFileSync(file, "utf8").split("\n");
  let ruleStack = textmate.INITIAL;
  const problemas = [];
  lines.forEach((line, i) => {
    const result = grammar.tokenizeLine(line, ruleStack);
    ruleStack = result.ruleStack;
    for (const token of result.tokens) {
      const text = line.slice(token.startIndex, token.endIndex);
      if (!text.trim()) continue;
      const scope = scopeCorto(token.scopes);
      if (process.argv[3] === "-v") console.log(`${String(i + 1).padStart(3)}: ${JSON.stringify(text).padEnd(22)} ${scope}`);
      // identificadores comunes que NO deberían salir coloreados como tipo/palabra clave
      if (/^(n|an|de|por|a|o|y|es)$/i.test(text.trim()) && /storage|keyword|support/.test(scope)) {
        problemas.push(`línea ${i + 1}: "${text}" quedó como ${scope}`);
      }
      if (/string/.test(scope) && text.length > 40) {
        problemas.push(`línea ${i + 1}: texto larguísimo como string (${scope}): ${JSON.stringify(text.slice(0, 50))}`);
      }
    }
  });
  console.log(problemas.length ? "PROBLEMAS DE RESALTADO:" : "Resaltado sin problemas evidentes");
  for (const p of problemas) console.log("  " + p);
})();
