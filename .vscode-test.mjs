import { defineConfig } from "@vscode/test-cli";

const mocha = { timeout: 60000, ui: "bdd" };

export default defineConfig([
  {
    label: "con-carpeta",
    files: "test-integration/extension.test.js",
    workspaceFolder: "./ejemplos",
    mocha,
  },
  {
    // sin workspaceFolder: VS Code abre sin ninguna carpeta, como cuando se
    // abre un archivo suelto desde Finder
    label: "archivo-suelto",
    files: "test-integration/archivo-suelto.test.js",
    mocha,
  },
]);
