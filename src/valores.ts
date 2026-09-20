import type { Pos, RecordDecl } from "./ast";

export class RuntimeError extends Error {
  constructor(message: string, readonly pos?: Pos) {
    super(message);
  }
}

export class CancelledError extends Error {}

export class RecordVal {
  constructor(readonly typeName: string, readonly fields: Map<string, Value>) {}

  clone(): RecordVal {
    const copy = new Map<string, Value>();
    for (const [key, value] of this.fields) copy.set(key, cloneValue(value));
    return new RecordVal(this.typeName, copy);
  }
}

export class ArrayVal {
  constructor(readonly dims: { low: number; high: number }[], readonly data: Value[]) {}

  offset(indices: number[], pos?: Pos): number {
    let offset = 0;
    for (let d = 0; d < this.dims.length; d++) {
      const dim = this.dims[d];
      const idx = indices[d];
      if (idx < dim.low || idx > dim.high) {
        throw new RuntimeError(
          `El índice ${idx} queda fuera del rango declarado [${dim.low}..${dim.high}].`,
          pos
        );
      }
      const size = dim.high - dim.low + 1;
      offset = offset * size + (idx - dim.low);
    }
    return offset;
  }

  clone(): ArrayVal {
    return new ArrayVal(this.dims, this.data.map(cloneValue));
  }
}

export type Value = number | string | boolean | RecordVal | ArrayVal | Archivo | Secuencia;

/** lo que devuelve una variable declarada ARCHIVO o SECUENCIA: la asigna el módulo archivos */
export interface Archivo {
  readonly clase: "archivo";
  readonly nombre: string;
  readonly registro?: RecordDecl;
  abierto: boolean;
  fda: boolean;
}

export interface Secuencia {
  readonly clase: "secuencia";
  readonly nombre: string;
  abierta: boolean;
  fds: boolean;
}

export function esArchivo(valor: Value): valor is Archivo {
  return typeof valor === "object" && valor !== null && (valor as Archivo).clase === "archivo";
}

export function esSecuencia(valor: Value): valor is Secuencia {
  return typeof valor === "object" && valor !== null && (valor as Secuencia).clase === "secuencia";
}

export function cloneValue(value: Value): Value {
  if (value instanceof RecordVal) return value.clone();
  if (value instanceof ArrayVal) return value.clone();
  return value;
}

export function formatValue(value: Value): string {
  if (typeof value === "number") {
    if (Number.isInteger(value)) return String(value);
    return String(Number(value.toFixed(10)));
  }
  if (typeof value === "boolean") return value ? "verdadero" : "falso";
  if (value instanceof RecordVal) return [...value.fields.values()].map(formatValue).join(" | ");
  if (value instanceof ArrayVal) return `[${value.data.map(formatValue).join(", ")}]`;
  if (esArchivo(value)) return `<archivo ${value.nombre}>`;
  if (esSecuencia(value)) return `<secuencia ${value.nombre}>`;
  return value;
}
