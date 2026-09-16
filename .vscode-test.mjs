import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "test-integration/**/*.test.js",
  workspaceFolder: "./ejemplos",
  mocha: { timeout: 60000, ui: "bdd" },
});
