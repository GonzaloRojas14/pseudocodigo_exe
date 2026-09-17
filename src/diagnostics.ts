import type { Pos } from "./ast";

export interface Diagnostic {
  pos: Pos;
  message: string;
  severity: "error" | "warning" | "info";
  /** otro lugar del archivo que ayuda a entender el error (el SI que quedó abierto, por ejemplo) */
  related?: { pos: Pos; message: string }[];
}

export function diag(
  pos: Pos,
  message: string,
  severity: Diagnostic["severity"] = "error",
  related?: Diagnostic["related"]
): Diagnostic {
  return { pos, message, severity, related };
}
