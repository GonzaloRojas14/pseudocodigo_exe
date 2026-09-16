import type { Pos } from "./ast";

export interface Diagnostic {
  pos: Pos;
  message: string;
  severity: "error" | "warning" | "info";
}

export function diag(pos: Pos, message: string, severity: Diagnostic["severity"] = "error"): Diagnostic {
  return { pos, message, severity };
}
