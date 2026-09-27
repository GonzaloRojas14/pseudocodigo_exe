import type { Pos } from "./ast";

export type Notation = "moderna" | "vieja";

export interface Token {
  type: string;
  /** valor canónico (palabras clave normalizadas, texto de identificadores/literales) */
  value: string;
  raw: string;
  pos: Pos;
  notation?: Notation;
}

export interface LexNote {
  pos: Pos;
  message: string;
  severity: "error" | "warning" | "info";
}

interface KeywordSpec {
  type: string;
  notation?: Notation;
  note?: string;
}

/**
 * Cada forma aceptada por la cátedra, incluidas las variantes de las plantillas
 * viejas (sintaxis-completa.md §1). La clave está en minúscula y sin espacios.
 */
const KEYWORDS: Record<string, KeywordSpec> = {
  accion: { type: "ACCION" },
  acción: { type: "ACCION" },
  es: { type: "ES" },
  ambiente: { type: "AMBIENTE" },
  proceso: { type: "PROCESO", notation: "moderna" },
  algoritmo: { type: "PROCESO", notation: "vieja" },
  fin_accion: { type: "FIN_ACCION", notation: "moderna" },
  fin_acción: { type: "FIN_ACCION", notation: "moderna" },
  finaccion: { type: "FIN_ACCION", notation: "vieja" },
  finacción: { type: "FIN_ACCION", notation: "vieja" },
  fin_proceso: {
    type: "FIN_PROCESO",
    note: "El Proceso no lleva FIN_PROCESO: del cuerpo se pasa directo a FIN_ACCION.",
  },
  finproceso: {
    type: "FIN_PROCESO",
    note: "El Proceso no lleva FIN_PROCESO: del cuerpo se pasa directo a FIN_ACCION.",
  },
  finalgoritmo: { type: "FIN_PROCESO", notation: "vieja" },
  fin_algoritmo: { type: "FIN_PROCESO", notation: "vieja" },

  si: { type: "SI" },
  entonces: { type: "ENTONCES" },
  sino: { type: "SINO", notation: "moderna" },
  contrario: { type: "CONTRARIO", notation: "vieja" },
  fin_si: { type: "FIN_SI", notation: "moderna" },
  finsi: { type: "FIN_SI", notation: "vieja" },

  segun: { type: "SEGUN" },
  según: { type: "SEGUN" },
  otros: { type: "OTROS" },
  fin_segun: { type: "FIN_SEGUN", notation: "moderna" },
  fin_según: { type: "FIN_SEGUN", notation: "moderna" },
  finsegun: { type: "FIN_SEGUN", notation: "vieja" },
  finsegún: { type: "FIN_SEGUN", notation: "vieja" },

  mientras: { type: "MIENTRAS" },
  fin_mientras: { type: "FIN_MIENTRAS", notation: "moderna" },
  finmientras: { type: "FIN_MIENTRAS", notation: "vieja" },
  repetir: { type: "REPETIR" },
  hasta: { type: "HASTA" },
  que: { type: "QUE" },
  para: { type: "PARA" },
  fin_para: { type: "FIN_PARA", notation: "moderna" },
  finpara: { type: "FIN_PARA", notation: "vieja" },
  hacer: { type: "HACER" },

  funcion: { type: "FUNCION" },
  función: { type: "FUNCION" },
  fin_funcion: { type: "FIN_FUNCION", notation: "moderna" },
  fin_función: { type: "FIN_FUNCION", notation: "moderna" },
  finfuncion: { type: "FIN_FUNCION", notation: "vieja" },
  finfunción: { type: "FIN_FUNCION", notation: "vieja" },
  procedimiento: { type: "PROCEDIMIENTO" },
  fin_procedimiento: { type: "FIN_PROCEDIMIENTO", notation: "moderna" },
  finprocedimiento: { type: "FIN_PROCEDIMIENTO", notation: "vieja" },
  fin_proc: { type: "FIN_PROCEDIMIENTO", notation: "vieja" },
  finproc: { type: "FIN_PROCEDIMIENTO", notation: "vieja" },
  fin: { type: "FIN_PROCEDIMIENTO", notation: "vieja" },

  processo: { type: "PROCESO", note: "Se escribe Proceso, con una sola S (errores-y-trampas #22)." },
  fin_processo: { type: "FIN_PROCESO", note: "Se escribe Proceso, y el Proceso no lleva FIN_PROCESO (errores-y-trampas #22)." },
  finprocesso: { type: "FIN_PROCESO", note: "Se escribe Proceso, y el Proceso no lleva FIN_PROCESO (errores-y-trampas #22)." },
  registro: { type: "REGISTRO" },
  fin_registro: { type: "FIN_REGISTRO", notation: "moderna" },
  finregistro: { type: "FIN_REGISTRO", notation: "vieja" },
  arreglo: { type: "ARREGLO" },
  archivo: { type: "ARCHIVO" },
  secuencia: { type: "SECUENCIA" },
  indexado: { type: "INDEXADO" },
  ordenado: { type: "ORDENADO" },
  por: { type: "POR" },
  de: { type: "DE" },
  var: { type: "VAR" },

  leer: { type: "LEER" },
  escribir: { type: "ESCRIBIR", notation: "moderna" },
  esc: { type: "ESCRIBIR", notation: "vieja" },
  grabar: { type: "ESCRIBIR", notation: "vieja" },
  "re-escribir": { type: "RE-ESCRIBIR" },
  reescribir: {
    type: "RE-ESCRIBIR",
    note: "Se escribe RE-ESCRIBIR, con guión (errores-y-trampas #23).",
  },
  eliminar: { type: "ELIMINAR" },
  cerrar: { type: "CERRAR" },
  fda: { type: "FDA", notation: "moderna" },
  nfda: { type: "NFDA", notation: "moderna" },
  nofda: { type: "NFDA", notation: "vieja" },
  fds: { type: "FDS", notation: "moderna" },
  nfds: { type: "NFDS", notation: "moderna" },
  nofds: { type: "NFDS", notation: "vieja" },
  arr: { type: "ARR" },
  arrancar: { type: "ARR", note: "La cátedra lo abrevia: ARR(sec)." },
  avz: { type: "AVZ" },
  avanzar: { type: "AVZ", note: "La cátedra lo abrevia: AVZ(sec, v)." },
  crear: { type: "CREAR" },
  existe: { type: "EXISTE" },

  y: { type: "Y" },
  o: { type: "O" },
  no: { type: "NO" },
  en: { type: "EN" },
  mod: { type: "MOD" },
  div: { type: "DIV" },
  verdadero: { type: "VERDADERO" },
  falso: { type: "FALSO" },

  entero: { type: "TIPO" },
  real: { type: "TIPO" },
  caracter: { type: "TIPO" },
  carácter: { type: "TIPO" },
  logico: { type: "TIPO" },
  lógico: { type: "TIPO" },
  alfanumerico: { type: "TIPO" },
  alfanumérico: { type: "TIPO" },
  // el tipo se nombra en singular, pero el plural aparece seguido en las resoluciones
  enteros: { type: "TIPO", note: "El tipo va en singular: SECUENCIA de entero." },
  reales: { type: "TIPO", note: "El tipo va en singular: SECUENCIA de real." },
  caracteres: { type: "TIPO", note: "El tipo va en singular: SECUENCIA de caracter." },
  logicos: { type: "TIPO", note: "El tipo va en singular: de logico." },
  lógicos: { type: "TIPO", note: "El tipo va en singular: de logico." },
};

/** canoniza el nombre de tipo: quita acentos para que "carácter" y "caracter" sean lo mismo */
const TYPE_CANON: Record<string, string> = {
  entero: "entero",
  enteros: "entero",
  real: "real",
  reales: "real",
  caracter: "caracter",
  carácter: "caracter",
  caracteres: "caracter",
  logico: "logico",
  lógico: "logico",
  logicos: "logico",
  lógicos: "logico",
  alfanumerico: "alfanumerico",
  alfanumérico: "alfanumerico",
};

/**
 * Lo que llega al pegar desde un PDF, las filminas o Word. Se acepta y se avisa,
 * porque si no el archivo entero queda lleno de "carácter inesperado".
 */
const ESPACIOS_RAROS = new Set(["\u00a0", "\u2007", "\u202f", "\u200b", "\u2009", "\u2002", "\u2003"]);

const COMILLAS: Record<string, string> = {
  '"': '"',
  "'": "'",
  "\u201c": "\u201d",
  "\u2018": "\u2019",
  "\u201e": "\u201c",
  "\u00ab": "\u00bb",
};

const OPERADORES_RAROS: Record<string, { texto: string; aviso: string }> = {
  "\u2212": { texto: "-", aviso: "El signo menos es -, no − (viene de copiar y pegar)." },
  "\u2013": { texto: "-", aviso: "El signo menos es -, no – (viene de copiar y pegar)." },
  "\u2014": { texto: "-", aviso: "El signo menos es -, no — (viene de copiar y pegar)." },
  "\u2260": { texto: "<>", aviso: "El operador distinto se escribe <>." },
  "\u2264": { texto: "<=", aviso: "El operador se escribe <=." },
  "\u2265": { texto: ">=", aviso: "El operador se escribe >=." },
  "\u00d7": { texto: "*", aviso: "La multiplicación se escribe *." },
  "\u00f7": { texto: "/", aviso: "La división se escribe /." },
};

const NAME_START = /[\p{L}_]/u;
const NAME_PART = /[\p{L}\p{N}_]/u;
/** nombres "sueltos" de ACCION/FUNCION/PROCEDIMIENTO, que en la práctica llevan puntos: ej2.2.1 */
const LOOSE_NAME_PART = /[\p{L}\p{N}_.]/u;

/**
 * Palabras clave que solo cuentan como tales si están invocadas con paréntesis.
 * Fuera de eso son identificadores comunes: "arr" es el nombre más habitual para
 * un arreglo y "avz" aparece como variable en apuntes.
 */
const PRIMITIVAS_AMBIGUAS = new Set(["arr", "avz"]);

export interface LexResult {
  tokens: Token[];
  notes: LexNote[];
}

export function tokenize(source: string): LexResult {
  const tokens: Token[] = [];
  const notes: LexNote[] = [];

  let i = 0;
  let line = 1;
  let col = 1;
  if (source.charCodeAt(0) === 0xfeff) i = 1;
  /** el próximo identificador es el nombre de una ACCION/FUNCION/PROCEDIMIENTO */
  let expectLooseName = false;

  const at = (k = 0) => source[i + k] ?? "";
  const posAt = (start: number, startLine: number, startCol: number): Pos => ({
    line: startLine,
    col: startCol,
    offset: start,
    length: i - start,
  });

  const advance = (n = 1) => {
    for (let k = 0; k < n; k++) {
      if (source[i] === "\n") {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
    }
  };

  const push = (type: string, value: string, start: number, sl: number, sc: number, notation?: Notation) => {
    tokens.push({ type, value, raw: source.slice(start, i), pos: posAt(start, sl, sc), notation });
  };

  while (i < source.length) {
    const ch = at();

    if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n" || ESPACIOS_RAROS.has(ch)) {
      advance();
      continue;
    }

    const start = i;
    const sl = line;
    const sc = col;

    // comentarios
    if (ch === "/" && at(1) === "/") {
      while (i < source.length && at() !== "\n") advance();
      continue;
    }
    if (ch === "#") {
      while (i < source.length && at() !== "\n") advance();
      notes.push({
        pos: posAt(start, sl, sc),
        message: "La cátedra usa // para comentarios de línea (y /* */ para bloque); # no es notación oficial.",
        severity: "warning",
      });
      continue;
    }
    if (ch === "/" && at(1) === "*") {
      advance(2);
      while (i < source.length && !(at() === "*" && at(1) === "/")) advance();
      if (i >= source.length) {
        notes.push({ pos: posAt(start, sl, sc), message: "Comentario de bloque sin cerrar (falta */).", severity: "error" });
      } else {
        advance(2);
      }
      continue;
    }

    // literales de texto
    if (COMILLAS[ch]) {
      const quote = COMILLAS[ch];
      if (ch !== '"' && ch !== "'") {
        notes.push({
          pos: { line: sl, col: sc, offset: start, length: 1 },
          message: `Comillas tipográficas (${ch}): vienen de copiar y pegar. La cátedra usa " o '.`,
          severity: "warning",
        });
      }
      advance();
      let value = "";
      while (i < source.length && at() !== quote && at() !== "\n") {
        value += at();
        advance();
      }
      if (at() === quote) {
        advance();
      } else {
        notes.push({ pos: posAt(start, sl, sc), message: `Literal de texto sin cerrar (falta ${quote}).`, severity: "error" });
      }
      push("STRING", value, start, sl, sc);
      continue;
    }

    // nombre suelto (después de ACCION / FUNCION / PROCEDIMIENTO): puede empezar con dígito
    // y llevar puntos, como el "ACCION 2.2.4 ES" que aparece en las resoluciones
    if (expectLooseName && NAME_PART.test(ch)) {
      expectLooseName = false;
      while (i < source.length && LOOSE_NAME_PART.test(at())) advance();
      let name = source.slice(start, i);
      while (name.endsWith(".")) {
        name = name.slice(0, -1);
        i--;
        col--;
      }
      push("IDENT", name, start, sl, sc);
      continue;
    }

    // números
    if (/[0-9]/.test(ch)) {
      while (/[0-9]/.test(at())) advance();
      let isReal = false;
      if (at() === "." && /[0-9]/.test(at(1))) {
        isReal = true;
        advance();
        while (/[0-9]/.test(at())) advance();
      }
      const raw = source.slice(start, i);
      const tok: Token = {
        type: "NUMBER",
        value: raw,
        raw,
        pos: posAt(start, sl, sc),
      };
      (tok as Token & { isReal: boolean }).isReal = isReal;
      tokens.push(tok);
      continue;
    }

    // identificadores y palabras clave
    if (NAME_START.test(ch)) {
      while (i < source.length && NAME_PART.test(at())) advance();
      let word = source.slice(start, i);

      // RE-ESCRIBIR es una sola palabra clave con guión en el medio
      if (word.toLowerCase() === "re" && at() === "-" && /escribir/i.test(source.slice(i + 1, i + 9))) {
        advance(9);
        word = source.slice(start, i);
      }

      const lower = word.toLowerCase();
      let kw: (typeof KEYWORDS)[string] | undefined = KEYWORDS[lower];

      // Primitivas de secuencia que además son nombres de variable naturalísimos.
      // "arr" es ARR(sec) —arrancar—, pero también es como todo el mundo llama a
      // un arreglo; las filminas de la cátedra usan las dos cosas. Se resuelve por
      // contexto: es la primitiva solo si viene seguida de "(". Mismo criterio que
      // se usó con "sec".
      if (kw && PRIMITIVAS_AMBIGUAS.has(lower)) {
        const resto = source.slice(i);
        if (!/^\s*\(/.test(resto)) kw = undefined;
      }

      if (kw) {
        if (kw.note) notes.push({ pos: posAt(start, sl, sc), message: kw.note, severity: "warning" });
        const value = kw.type === "TIPO" ? TYPE_CANON[lower] : kw.type;
        push(kw.type, value, start, sl, sc, kw.notation);
        if (kw.type === "ACCION" || kw.type === "FUNCION" || kw.type === "PROCEDIMIENTO") {
          expectLooseName = true;
        }
        continue;
      }

      // ABRIR + modo pegado: ABRIRe / ABRIRs / ABRIRe/s
      if (/^abrir(e|s|es)?$/.test(lower)) {
        push("ABRIR", "ABRIR", start, sl, sc, lower === "abrir" ? "moderna" : "vieja");
        const modeStart = i;
        const msl = line;
        const msc = col;
        let mode = lower === "abrir" ? "" : lower.slice(5).toUpperCase();
        // sufijos sueltos: "E/", "/S", "E/S", o el "/s" de ABRIRe/s
        const rest = source.slice(i);
        const m = mode
          ? /^\s*\/\s*([es])/i.exec(rest)
          : /^\s*(e\s*\/\s*s|e\s*\/|\/\s*s|e|s)(?=\s*\()/i.exec(rest);
        if (m) {
          advance(m[0].length);
          const frag = (mode ? mode + m[1] : m[1]).replace(/[\s/]/g, "").toUpperCase();
          mode = frag;
        }
        mode = mode.replace(/[^ES]/g, "");
        if (!mode) {
          notes.push({
            pos: posAt(modeStart, msl, msc),
            message: "Falta el modo de apertura: ABRIR E/(arch), ABRIR /S(arch) o ABRIR E/S(arch).",
            severity: "error",
          });
          mode = "E";
        }
        tokens.push({
          type: "OPENMODE",
          value: mode === "SE" ? "ES" : mode,
          raw: source.slice(modeStart, i),
          pos: posAt(modeStart, msl, msc),
        });
        continue;
      }

      push("IDENT", word, start, sl, sc);
      continue;
    }

    // operadores y signos
    const three = source.slice(i, i + 2);
    if (three === ":=") {
      advance(2);
      push(":=", ":=", start, sl, sc);
      continue;
    }
    if (three === "<>") {
      advance(2);
      push("<>", "<>", start, sl, sc);
      continue;
    }
    if (three === ">=" || three === "<=") {
      advance(2);
      push(three, three, start, sl, sc);
      continue;
    }
    if (three === "**") {
      advance(2);
      push("**", "**", start, sl, sc);
      continue;
    }
    if (three === "..") {
      advance(2);
      if (at() === ".") {
        // las filminas tienen algún "1...10"; el rango va con dos puntos
        while (at() === ".") advance();
        notes.push({
          pos: posAt(start, sl, sc),
          message: "El rango se escribe con dos puntos: [1..10].",
          severity: "warning",
        });
      }
      push("..", "..", start, sl, sc);
      continue;
    }
    if (three === "!=") {
      advance(2);
      notes.push({ pos: posAt(start, sl, sc), message: "El operador distinto es <>, no != (errores-y-trampas #12 de notación).", severity: "warning" });
      push("<>", "<>", start, sl, sc);
      continue;
    }

    const raro = OPERADORES_RAROS[ch];
    if (raro) {
      advance();
      notes.push({ pos: posAt(start, sl, sc), message: raro.aviso, severity: "warning" });
      push(raro.texto, raro.texto, start, sl, sc);
      continue;
    }

    if ("+-*/=<>(),;:.[]^".includes(ch)) {
      advance();
      // ^ aparece en resoluciones como potencia; la cátedra usa **
      if (ch === "^") {
        notes.push({ pos: posAt(start, sl, sc), message: "La potencia se escribe ** en la notación de la cátedra.", severity: "warning" });
        push("**", "**", start, sl, sc);
        continue;
      }
      push(ch, ch, start, sl, sc);
      continue;
    }

    advance();
    notes.push({ pos: posAt(start, sl, sc), message: `Carácter inesperado: ${ch}`, severity: "error" });
  }

  tokens.push({ type: "EOF", value: "", raw: "", pos: { line, col, offset: i, length: 0 } });
  return { tokens, notes };
}
