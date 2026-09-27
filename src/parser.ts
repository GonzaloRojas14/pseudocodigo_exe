import type {
  Declaration,
  Expr,
  FieldDecl,
  LValue,
  Param,
  Pos,
  Program,
  RecordDecl,
  SegunBranch,
  Stmt,
  SubprogramDecl,
  TypeNode,
} from "./ast";
import { tokenize, type Token } from "./lexer";
import { diag, type Diagnostic } from "./diagnostics";
import { enumerar, masParecido } from "./texto";

class ParseError extends Error {}

/** cómo se llama y cómo se cierra cada bloque, para los mensajes */
const BLOQUES: Record<string, { nombre: string; cierre: string }> = {
  SI: { nombre: "SI", cierre: "FIN_SI" },
  MIENTRAS: { nombre: "MIENTRAS", cierre: "FIN_MIENTRAS" },
  PARA: { nombre: "PARA", cierre: "FIN_PARA" },
  SEGUN: { nombre: "SEGUN", cierre: "FIN_SEGUN" },
  REGISTRO: { nombre: "REGISTRO", cierre: "FIN_REGISTRO" },
  FUNCION: { nombre: "FUNCION", cierre: "FIN_FUNCION" },
  PROCEDIMIENTO: { nombre: "PROCEDIMIENTO", cierre: "FIN_PROCEDIMIENTO" },
  ACCION: { nombre: "ACCION", cierre: "FIN_ACCION" },
};

const DECL_STOP = new Set([
  "PROCESO",
  "FIN_ACCION",
  "FIN_FUNCION",
  "FIN_PROCEDIMIENTO",
  "EOF",
  // si aparece una instrucción sin haber escrito "Proceso", ahí terminó el Ambiente
  "SI",
  "SEGUN",
  "MIENTRAS",
  "REPETIR",
  "PARA",
  "ESCRIBIR",
  "ABRIR",
  "CERRAR",
  "ARR",
  "AVZ",
  "CREAR",
  "RE-ESCRIBIR",
  "ELIMINAR",
]);

const STMT_STOP = new Set([
  "FIN_SI",
  "SINO",
  "CONTRARIO",
  "FIN_MIENTRAS",
  "FIN_PARA",
  "FIN_SEGUN",
  "FIN_ACCION",
  "FIN_PROCESO",
  "FIN_FUNCION",
  "FIN_PROCEDIMIENTO",
  "HASTA",
  "OTROS",
  "EOF",
]);

const RELATIONAL = new Set(["=", "<>", ">", ">=", "<", "<=", "EN"]);

export interface ParseResult {
  program?: Program;
  diagnostics: Diagnostic[];
}

export function parse(source: string): ParseResult {
  const { tokens, notes } = tokenize(source);
  const parser = new Parser(tokens);
  const diagnostics: Diagnostic[] = notes.map((n) => diag(n.pos, n.message, n.severity));
  let program: Program | undefined;
  try {
    program = parser.parseProgram();
  } catch (err) {
    if (!(err instanceof ParseError)) throw err;
  }
  diagnostics.push(...parser.diagnostics);
  diagnostics.sort((a, b) => a.pos.offset - b.pos.offset);
  return { program, diagnostics };
}

class Parser {
  diagnostics: Diagnostic[] = [];
  private index = 0;
  /** registros declarados dentro de otro registro: se suben al Ambiente que los contiene */
  private hoistedTypes: RecordDecl[] = [];
  /** bloques abiertos, para distinguir "falta un cierre" de "sobra un cierre" */
  private abiertos: Token[] = [];

  constructor(private tokens: Token[]) {}

  // ── utilidades ───────────────────────────────────────────────────────────

  private peek(k = 0): Token {
    return this.tokens[Math.min(this.index + k, this.tokens.length - 1)];
  }

  private get current(): Token {
    return this.peek();
  }

  private next(): Token {
    const tok = this.current;
    if (this.index < this.tokens.length - 1) this.index++;
    return tok;
  }

  private check(type: string): boolean {
    return this.current.type === type;
  }

  private accept(type: string): Token | undefined {
    if (this.check(type)) return this.next();
    return undefined;
  }

  private error(message: string, pos: Pos = this.current.pos): never {
    this.report(diag(pos, message));
    throw new ParseError(message);
  }

  private warn(message: string, pos: Pos = this.current.pos): void {
    this.report(diag(pos, message, "warning"));
  }

  private report(item: Diagnostic): void {
    if (this.diagnostics.length < 200) this.diagnostics.push(item);
  }

  private expect(type: string, what: string): Token {
    if (this.check(type)) return this.next();
    const encontrado = this.current.raw || this.current.type;
    // typo en una palabra clave: HACAER por HACER, ENTONSES por ENTONCES...
    const esPalabraClave = /^[A-ZÁÉÍÓÚ_-]+$/.test(type);
    const sugerencia =
      esPalabraClave && this.current.type === "IDENT" && masParecido(this.current.value, [type])
        ? ` ¿Quisiste escribir ${type}?`
        : "";
    return this.error(`Se esperaba ${what} y apareció "${encontrado}".${sugerencia}`);
  }

  /**
   * Cierra un bloque. Si el cierre no está, el error apunta a dónde quedó abierto,
   * que es lo que uno necesita saber para arreglarlo.
   */
  private abrirBloque(apertura: Token): Token {
    this.abiertos.push(apertura);
    return apertura;
  }

  private expectCloser(apertura: Token): void {
    const bloque = BLOQUES[apertura.type];
    const indice = this.abiertos.lastIndexOf(apertura);
    if (indice >= 0) this.abiertos.splice(indice, 1);

    if (this.check(bloque.cierre)) {
      this.next();
      return;
    }

    // un cierre que falta suele ser consecuencia de un error anterior: con arreglar
    // el primero se acomoda todo, así que no se llena el panel de errores derivados
    if (this.diagnostics.some((d) => d.severity === "error")) {
      throw new ParseError(`Falta ${bloque.cierre}`);
    }

    const encontrado = this.current.raw || this.current.type;
    const esOtroCierre = Object.values(BLOQUES).some((b) => b.cierre === this.current.type);
    const loEsperaOtroBloque = this.abiertos.some((t) => BLOQUES[t.type].cierre === this.current.type);

    if (esOtroCierre && !loEsperaOtroBloque) {
      const duenio = Object.values(BLOQUES).find((b) => b.cierre === this.current.type)?.nombre;
      this.diagnostics.push(
        diag(
          this.current.pos,
          `Sobra este ${encontrado}: no hay ningún ${duenio} abierto para cerrar acá. ` +
            `Lo que sí falta cerrar es el ${bloque.nombre} de la línea ${apertura.pos.line}, con ${bloque.cierre}.`,
          "error",
          [{ pos: apertura.pos, message: `Este ${bloque.nombre} sigue abierto.` }]
        )
      );
      throw new ParseError("cierre de más");
    }

    this.diagnostics.push(
      diag(
        this.current.pos,
        `Falta ${bloque.cierre}: el ${bloque.nombre} que empieza en la línea ${apertura.pos.line} quedó sin cerrar` +
          (this.check("EOF") ? " y el archivo se terminó." : `, y acá apareció "${encontrado}".`),
        "error",
        [{ pos: apertura.pos, message: `Este ${bloque.nombre} es el que falta cerrar.` }]
      )
    );
    throw new ParseError(`Falta ${bloque.cierre}`);
  }

  /** ; y . sueltos: separadores opcionales de las plantillas viejas */
  private skipTerminators(): void {
    while (this.check(";") || this.check(".")) this.next();
  }

  /** entre instrucciones también aparecen "," y ":" como separadores */
  private skipStatementSeparators(): void {
    while (this.check(";") || this.check(".") || this.check(",") || this.check(":")) this.next();
  }

  /** "ACCION x ES:" y "SEGUN x HACER:" llevan dos puntos de más */
  private skipStrayColon(context: string): void {
    if (this.check(":")) {
      this.warn(`${context} no lleva dos puntos (errores-y-trampas #24).`);
      this.next();
    }
  }

  private identName(what: string): { name: string; pos: Pos } {
    const tok = this.current;
    if (tok.type === "IDENT" || tok.type === "TIPO") {
      this.next();
      return { name: tok.value, pos: tok.pos };
    }
    return this.error(`Se esperaba ${what} y apareció "${tok.raw || tok.type}".`);
  }

  /** salta hasta el próximo punto de sincronización para poder seguir reportando errores */
  private recoverStatement(): void {
    const startLine = this.current.pos.line;
    while (!this.check("EOF")) {
      if (STMT_STOP.has(this.current.type)) return;
      if (this.current.pos.line > startLine) return;
      this.next();
    }
  }

  // ── programa ─────────────────────────────────────────────────────────────

  parseProgram(): Program {
    this.skipTerminators();
    const accion = this.abrirBloque(this.expect("ACCION", "ACCION al inicio del algoritmo"));
    const { name, pos: namePos } = this.identName("el nombre de la acción");

    // en algunos apuntes la ACCION se plantea con parámetros, como si fuera una subacción
    const params = this.parseParams();
    if (params.length > 0) {
      this.warn(
        "La ACCION principal no recibe parámetros: se toman como variables del Ambiente.",
        namePos
      );
    }

    if (this.check("IDENT")) {
      this.warn(
        `El nombre de la ACCION no lleva espacios: "${name} ${this.current.value}" iría como "${name}_${this.current.value}" (errores-y-trampas #26).`,
        this.current.pos
      );
      this.next();
    }

    if (!this.accept("ES")) {
      this.warn(`Falta "ES" después del nombre: va "ACCION ${name} ES".`, namePos);
    }
    this.skipStrayColon("ACCION ... ES");

    let declarations: Declaration[] = params.map((param) => ({
      kind: "var" as const,
      pos: param.pos,
      names: [param.name],
      type: param.type,
    }));
    if (this.accept("AMBIENTE")) {
      declarations = [...declarations, ...this.parseDeclarations()];
    } else {
      this.warn("Falta el Ambiente: va siempre, aunque quede vacío (sintaxis-completa §1).", this.current.pos);
    }

    if (!this.accept("PROCESO")) {
      this.warn('Falta "Proceso" antes de las instrucciones (sintaxis-completa §1).');
    }
    this.skipStrayColon("Proceso");
    const body = this.parseStatements();

    if (this.check("FIN_PROCESO")) this.next();
    this.expectCloser(accion);

    const notations = new Set<string>();
    for (const tok of this.tokens) if (tok.notation) notations.add(tok.notation);

    return {
      pos: accion.pos,
      name,
      namePos,
      declarations,
      body,
      notations,
    };
  }

  // ── declaraciones ────────────────────────────────────────────────────────

  private parseDeclarations(): Declaration[] {
    const decls: Declaration[] = [];
    while (!DECL_STOP.has(this.current.type)) {
      this.skipTerminators();
      if (DECL_STOP.has(this.current.type)) break;
      const before = this.index;
      try {
        const decl = this.parseDeclaration();
        decls.push(...this.hoistedTypes.splice(0), decl);
      } catch (err) {
        if (!(err instanceof ParseError)) throw err;
        this.recoverStatement();
        // la recuperación tiene que avanzar sí o sí: si no, el ciclo no termina nunca
        if (this.index === before) this.next();
        if (this.check("EOF")) break;
      }
      this.skipTerminators();
    }
    return decls;
  }

  private parseDeclaration(): Declaration {
    if (this.check("FUNCION") || this.check("PROCEDIMIENTO")) return this.parseSubprogram();

    const first = this.identName("un nombre de variable, constante o tipo");
    const names = [first.name];
    while (this.accept(",")) {
      if (this.check(":")) {
        this.warn("Sobra una coma antes del tipo.");
        break;
      }
      names.push(this.identName("otro nombre de variable").name);
    }

    if (this.accept(":")) {
      // "facturas : REGISTRO ... FIN_REGISTRO": un REGISTRO define un tipo, va con =
      if (this.check("REGISTRO") && names.length === 1) {
        this.warn(`Un REGISTRO define un tipo y se declara con "=": ${first.name} = REGISTRO.`);
        this.next();
        const fields = this.parseFields();
        this.expect("FIN_REGISTRO", "FIN_REGISTRO para cerrar el registro");
        return { kind: "record", pos: first.pos, name: first.name, fields };
      }
      // "r : 0.4" es una constante escrita con : en vez de =, no un tipo
      if ((this.check("NUMBER") || this.check("STRING")) && this.peek(1).type !== "..") {
        this.error(
          `Una constante se declara con "=": ${first.name} = ${this.current.raw}. Con ":" va un tipo (entero, real, AN(50), ...).`
        );
      }
      const type = this.parseType();
      return { kind: "var", pos: first.pos, names, type };
    }

    if (names.length === 1 && this.accept("=")) {
      if (this.check("REGISTRO")) {
        this.next();
        const apertura = this.peek(-1);
        const fields = this.parseFields();
        this.expectCloser({ ...apertura, type: "REGISTRO" });
        return { kind: "record", pos: first.pos, name: first.name, fields };
      }
      const value = this.parseExpression();
      if (value.kind === "number") {
        this.constantesNumericas.set(first.name.toLowerCase(), value.value);
      }
      return { kind: "const", pos: first.pos, name: first.name, value };
    }

    return this.error(
      `Se esperaba ":" (declaración de variable) o "=" (constante o REGISTRO) después de "${first.name}".`
    );
  }

  private parseFields(): FieldDecl[] {
    const fields: FieldDecl[] = [];
    while (!this.check("FIN_REGISTRO") && !this.check("EOF")) {
      this.skipTerminators();
      if (this.check("FIN_REGISTRO") || this.check("EOF")) break;
      const names: { name: string; pos: Pos }[] = [this.identName("el nombre de un campo")];
      while (this.accept(",")) names.push(this.identName("otro nombre de campo"));

      // registro anidado declarado en el lugar: Fecha_Venta = REGISTRO ... FIN_REGISTRO
      if (names.length === 1 && this.check("=") && this.peek(1).type === "REGISTRO") {
        this.next();
        this.next();
        const nested = this.parseFields();
        this.expect("FIN_REGISTRO", "FIN_REGISTRO para cerrar el registro anidado");
        const decl = names[0];
        this.hoistedTypes.push({ kind: "record", pos: decl.pos, name: decl.name, fields: nested });
        fields.push({ pos: decl.pos, name: decl.name, type: { kind: "named", pos: decl.pos, name: decl.name } });
        this.skipTerminators();
        continue;
      }

      this.expect(":", '":" y el tipo del campo');
      const type = this.parseType();
      for (const n of names) fields.push({ pos: n.pos, name: n.name, type });
      this.skipTerminators();
    }
    return fields;
  }

  /** constantes numéricas ya declaradas, para poder usarlas como límite de arreglo */
  private constantesNumericas = new Map<string, number>();

  private parseParams(): Param[] {
    const params: Param[] = [];
    if (!this.accept("(")) return params;
    if (!this.check(")")) {
      do {
        const byRef = !!this.accept("VAR");
        const p = this.identName("el nombre del parámetro");
        this.expect(":", '":" y el tipo del parámetro');
        const type = this.parseType();
        params.push({ pos: p.pos, name: p.name, byRef, type });
      } while (this.accept(","));
    }
    this.expect(")", '")" para cerrar los parámetros');
    return params;
  }

  private parseSubprogram(): SubprogramDecl {
    const start = this.next(); // FUNCION | PROCEDIMIENTO
    const isFunction = start.type === "FUNCION";
    const { name } = this.identName(`el nombre ${isFunction ? "de la función" : "del procedimiento"}`);

    const params = this.parseParams();

    let returnType: TypeNode | undefined;
    if (this.accept(":")) returnType = this.parseType();
    if (isFunction && !returnType) {
      this.warn("Una FUNCION declara el tipo que devuelve: FUNCION nombre(...) : entero ES", start.pos);
    }

    if (!this.accept("ES")) {
      this.warn(`Falta "ES" después del nombre: va "${start.raw} ${name} ES".`, start.pos);
    }

    let locals: Declaration[] = [];
    if (this.accept("AMBIENTE")) locals = this.parseDeclarations();
    this.accept("PROCESO");
    const body = this.parseStatements();

    if (this.check("FIN_PROCESO")) this.next();
    const expectedCloser = isFunction ? "FIN_FUNCION" : "FIN_PROCEDIMIENTO";
    if (this.check("FIN_FUNCION") || this.check("FIN_PROCEDIMIENTO")) {
      // "Fin;" / "Fin_Proc;" de las plantillas viejas cierran cualquiera de las dos
      const closer = this.next();
      const isLegacyCloser = /^fin(_?proc)?\.?$/i.test(closer.raw.trim());
      if (closer.type !== expectedCloser && !isLegacyCloser) {
        this.warn(`Se esperaba ${expectedCloser} para cerrar "${name}".`, closer.pos);
      }
    } else {
      this.error(`Falta ${expectedCloser} para cerrar "${name}".`);
    }

    return { kind: "subprogram", pos: start.pos, isFunction, name, params, returnType, locals, body };
  }

  // ── tipos ────────────────────────────────────────────────────────────────

  private parseType(): TypeNode {
    const tok = this.current;

    if (tok.type === "TIPO") {
      this.next();
      return { kind: "scalar", pos: tok.pos, name: tok.value as "entero" };
    }

    if (tok.type === "ARREGLO") {
      this.next();
      // la cátedra escribe tanto "ARREGLO[1..10] de entero" como "ARREGLO DE [1..10] DE entero"
      this.accept("DE");
      this.expect("[", '"[" con los límites del arreglo');
      const dims: { low: number; high: number }[] = [];
      do {
        const low = this.parseBound();
        this.expect("..", '".." entre los límites del arreglo');
        const high = this.parseBound();
        dims.push({ low, high });
      } while (this.accept(","));
      this.expect("]", '"]" para cerrar los límites');
      this.expect("DE", '"de" y el tipo de los componentes');
      const element = this.parseType();
      return { kind: "array", pos: tok.pos, dims, element };
    }

    if (tok.type === "ARCHIVO") {
      this.next();
      this.expect("DE", '"de" y el tipo de los registros del archivo');
      const element = this.parseType();
      const orderedBy: string[] = [];
      const indexedBy: string[] = [];
      if (this.accept("ORDENADO")) {
        this.expect("POR", '"por" y las claves de ordenamiento');
        orderedBy.push(...this.parseKeyList());
      } else if (this.accept("INDEXADO")) {
        this.expect("POR", '"por" y la clave del índice');
        indexedBy.push(...this.parseKeyList());
      }
      return { kind: "archivo", pos: tok.pos, element, orderedBy, indexedBy };
    }

    if (tok.type === "SECUENCIA") {
      this.next();
      this.expect("DE", '"de" y el tipo de los elementos de la secuencia');
      const element = this.parseType();
      return { kind: "secuencia", pos: tok.pos, element };
    }

    // enumerado: ("IND","DOB") o ('A','B','M')
    if (tok.type === "(") {
      this.next();
      const values: string[] = [];
      if (!this.check(")")) {
        do {
          const lit = this.current;
          if (lit.type === "STRING" || lit.type === "NUMBER") {
            this.next();
            values.push(lit.value);
          } else {
            this.error("Los valores de un enumerado van entre comillas: ('A','B','M').");
          }
        } while (this.accept(","));
      }
      this.expect(")", '")" para cerrar el enumerado');
      return { kind: "enum", pos: tok.pos, values };
    }

    // subrango: 1..31
    if (tok.type === "NUMBER" && this.peek(1).type === "..") {
      const low = this.parseBound();
      this.expect("..", '".."');
      const high = this.parseBound();
      return { kind: "subrange", pos: tok.pos, low, high };
    }

    if (tok.type === "IDENT") {
      const upper = tok.value.toUpperCase();
      if ((upper === "AN" || upper === "N") && this.peek(1).type === "(") {
        this.next();
        this.next();
        const first = this.expect("NUMBER", "la cantidad de caracteres o dígitos");
        let decimals = 0;
        let hasDecimals = false;
        if (this.accept(",")) {
          decimals = Number(this.expect("NUMBER", "la cantidad de decimales").value);
          hasDecimals = true;
        }
        this.expect(")", '")"');
        if (upper === "AN") {
          return { kind: "text", pos: tok.pos, length: Number(first.value) };
        }
        return {
          kind: "numeric",
          pos: tok.pos,
          digits: Number(first.value),
          decimals: hasDecimals ? decimals : 0,
        };
      }
      // AN[50] con corchetes también aparece en plantillas de cátedra
      if (upper === "AN" && this.peek(1).type === "[") {
        this.next();
        this.next();
        const len = this.expect("NUMBER", "la cantidad de caracteres");
        this.expect("]", '"]"');
        return { kind: "text", pos: tok.pos, length: Number(len.value) };
      }
      // "sec : SEC DE CARACTER" — abreviatura frecuente; SEC solo es palabra clave acá,
      // en posición de tipo, porque "sec" es además el nombre de variable más usado
      if (upper === "SEC" && this.peek(1).type === "DE") {
        this.warn("Se escribe SECUENCIA de caracter, no SEC DE CARACTER (errores-y-trampas #25).");
        this.next();
        this.next();
        const element = this.parseType();
        return { kind: "secuencia", pos: tok.pos, element };
      }
      // "arch : ARHCIVO DE alumnos": un tipo desconocido seguido de "de" es una palabra clave mal escrita
      if (this.peek(1).type === "DE") {
        const suggestion = masParecido(tok.value, ["ARCHIVO", "SECUENCIA", "ARREGLO"]);
        this.error(
          `"${tok.value}" no es un tipo${suggestion ? `. ¿Quisiste escribir ${suggestion}?` : "."}`
        );
      }
      this.next();
      return { kind: "named", pos: tok.pos, name: tok.value };
    }

    return this.error(
      `Se esperaba un tipo y apareció "${tok.raw || tok.type}". Los tipos son ` +
        `${enumerar(["entero", "real", "caracter", "logico", "AN(n)", "N(n)", "un subrango como 1..31", "un enumerado como ('A','B')", "ARREGLO", "ARCHIVO", "SECUENCIA"], "o")}, ` +
        "o el nombre de un REGISTRO declarado antes."
    );
  }

  /**
   * Un límite de arreglo o de subrango. Puede ser un número literal o el nombre
   * de una constante numérica ya declarada: la cátedra escribe
   * "CONSTANTES N = 50" y después "V : ARREGLO[1..N] de entero".
   */
  private parseBound(): number {
    const negative = !!this.accept("-");
    if (this.check("IDENT")) {
      const tok = this.next();
      const valor = this.constantesNumericas.get(tok.value.toLowerCase());
      if (valor === undefined) {
        this.error(
          `El límite "${tok.value}" tiene que ser un número o una constante numérica ` +
            `declarada antes en el Ambiente. El tamaño de un arreglo se fija al declararlo, ` +
            `así que no puede depender de una variable.`,
          tok.pos
        );
        return 1;
      }
      return negative ? -valor : valor;
    }
    const tok = this.expect("NUMBER", "un límite numérico o una constante");
    const value = Number(tok.value);
    return negative ? -value : value;
  }

  /** "clave1, clave2 y clave3" */
  private parseKeyList(): string[] {
    const keys = [this.identName("el nombre de una clave").name];
    while (this.accept(",") || this.accept("Y")) {
      keys.push(this.identName("el nombre de otra clave").name);
    }
    return keys;
  }

  // ── sentencias ───────────────────────────────────────────────────────────

  private parseStatements(): Stmt[] {
    const stmts: Stmt[] = [];
    this.skipStatementSeparators();
    while (!STMT_STOP.has(this.current.type) && !this.isSegunLabelAhead()) {
      const before = this.index;
      const bloquesAbiertos = this.abiertos.length;
      try {
        stmts.push(this.parseStatement());
      } catch (err) {
        if (!(err instanceof ParseError)) throw err;
        this.abiertos.length = Math.min(this.abiertos.length, bloquesAbiertos);
        this.recoverStatement();
        if (this.index === before) this.next();
        if (this.check("EOF")) break;
      }
      this.skipStatementSeparators();
    }
    return stmts;
  }

  /** una rama de SEGUN empieza con un literal o con "otros" seguidos de ":" */
  private isSegunLabelAhead(): boolean {
    return (this.check("NUMBER") || this.check("STRING")) && this.labelFollows();
  }

  private labelFollows(): boolean {
    let k = 0;
    while (this.peek(k).type === "NUMBER" || this.peek(k).type === "STRING" || this.peek(k).type === ",") k++;
    return this.peek(k).type === ":";
  }

  private parseStatement(): Stmt {
    const tok = this.current;
    switch (tok.type) {
      case "SI":
        return this.parseIf();
      case "SEGUN":
        return this.parseSegun();
      case "MIENTRAS":
        return this.parseWhile();
      case "REPETIR":
        return this.parseRepeat();
      case "PARA":
        return this.parseFor();
      case "ESCRIBIR":
      case "LEER":
        return this.parseIo();
      case "ABRIR":
      case "CERRAR":
      case "ARR":
      case "AVZ":
      case "CREAR":
      case "RE-ESCRIBIR":
      case "ELIMINAR":
        return this.parseFileStmt();
      case "IDENT":
        return this.parseAssignOrCall();
      default: {
        const cierres: Record<string, string> = {
          FIN_SI: "SI",
          FIN_MIENTRAS: "MIENTRAS",
          FIN_PARA: "PARA",
          FIN_SEGUN: "SEGUN",
          FIN_ACCION: "ACCION",
        };
        const sobra = cierres[tok.type];
        if (sobra) {
          return this.error(
            `Sobra este ${tok.raw}: no hay ningún ${sobra} abierto para cerrar acá.`
          );
        }
        return this.error(
          `No se esperaba "${tok.raw || tok.type}" acá. Una instrucción arranca con el nombre de una ` +
            `variable (para asignarle algo con :=), con el nombre de un procedimiento, o con ` +
            `${enumerar(["SI", "SEGUN", "MIENTRAS", "REPETIR", "PARA", "ESCRIBIR", "LEER"], "o")}.`
        );
      }
    }
  }

  private parseIf(): Stmt {
    const start = this.abrirBloque(this.next());
    const cond = this.parseExpression();
    if (!this.accept("ENTONCES")) {
      this.error('Falta "ENTONCES" después de la condición del SI.');
    }
    if (this.check(":")) {
      this.warn("SI ... ENTONCES no lleva dos puntos (errores-y-trampas #24).");
      this.next();
    }
    const then = this.parseStatements();
    let elseBody: Stmt[] | undefined;
    if (this.check("SINO") || this.check("CONTRARIO")) {
      this.next();
      if (this.check(":")) {
        this.warn("SINO no lleva dos puntos (errores-y-trampas #24).");
        this.next();
      }
      elseBody = this.parseStatements();
    }
    this.expectCloser(start);
    return { kind: "if", pos: start.pos, cond, then, else: elseBody };
  }

  private parseSegun(): Stmt {
    const start = this.abrirBloque(this.next());
    const subject = this.parseExpression();
    this.expect("HACER", '"HACER" después de la expresión del SEGUN');
    this.skipStrayColon("SEGUN ... HACER");
    const branches: SegunBranch[] = [];
    while (!this.check("FIN_SEGUN") && !this.check("EOF")) {
      this.skipTerminators();
      if (this.check("FIN_SEGUN") || this.check("EOF")) break;
      const branchStart = this.current;
      const labels: Expr[] = [];
      if (this.check("OTROS") || this.check("CONTRARIO")) {
        this.next();
      } else {
        if (RELATIONAL.has(this.current.type)) {
          this.error(
            `Las ramas de un SEGUN van con valores sueltos ('A', 3, "ISI"), no con comparaciones. ` +
              "Para rangos va una cascada de SI ... SINO ... FIN_SI."
          );
        }
        do {
          labels.push(this.parsePrimary());
        } while (this.accept(","));
      }
      this.expect(":", '":" después de la etiqueta de la rama');
      const body = this.parseStatements();
      branches.push({ pos: branchStart.pos, labels, body });
    }
    this.expectCloser(start);
    return { kind: "segun", pos: start.pos, subject, branches };
  }

  private parseWhile(): Stmt {
    const start = this.abrirBloque(this.next());
    const cond = this.parseExpression();
    this.expect("HACER", '"HACER" después de la condición del MIENTRAS');
    const body = this.parseStatements();
    this.expectCloser(start);
    return { kind: "while", pos: start.pos, cond, body };
  }

  private parseRepeat(): Stmt {
    const start = this.next();
    const body = this.parseStatements();
    this.expect("HASTA", '"HASTA QUE" con la condición de corte');
    this.accept("QUE");
    const cond = this.parseExpression();
    return { kind: "repeat", pos: start.pos, body, cond };
  }

  private parseFor(): Stmt {
    const start = this.abrirBloque(this.next());
    const counter = this.identName("la variable contador del PARA").name;
    if (!this.accept(":=")) {
      if (this.accept("=")) {
        this.warn("El contador del PARA se inicializa con := (asignación), no con =.");
      } else {
        this.error('Se esperaba ":=" con el valor inicial del contador.');
      }
    }
    const from = this.parseExpression();
    if (!this.accept("HASTA")) {
      // en los apuntes de clase aparece "PARA i := 1 A 6, 1 HACER"
      if (this.check("IDENT") && this.current.value.toLowerCase() === "a") {
        this.warn('La cátedra escribe "HASTA": PARA i := 1 HASTA 6, 1 HACER.');
        this.next();
      } else {
        this.error('Se esperaba "HASTA" y el valor final del contador.');
      }
    }
    const to = this.parseExpression();
    let step: Expr | undefined;
    if (this.accept(",")) step = this.parseExpression();
    this.expect("HACER", '"HACER" antes del cuerpo del PARA');
    const body = this.parseStatements();
    this.expectCloser(start);
    return { kind: "for", pos: start.pos, counter, from, to, step, body };
  }

  private parseIo(): Stmt {
    const start = this.next();
    const op = start.type as "ESCRIBIR" | "LEER";
    this.expect("(", `"(" con los argumentos de ${op}`);
    const args: Expr[] = [];
    if (!this.check(")")) {
      do {
        args.push(this.parseExpression());
      } while (this.accept(","));
    }
    this.expect(")", '")" para cerrar los argumentos');
    return { kind: "io", pos: start.pos, op, args };
  }

  private parseFileStmt(): Stmt {
    const start = this.next();
    const op = start.type as
      | "ABRIR"
      | "CERRAR"
      | "ARR"
      | "AVZ"
      | "CREAR"
      | "RE-ESCRIBIR"
      | "ELIMINAR";
    let mode: "E" | "S" | "ES" | undefined;
    if (op === "ABRIR") {
      const modeTok = this.expect("OPENMODE", "el modo de apertura: E/, /S o E/S");
      mode = modeTok.value as "E" | "S" | "ES";
    }
    this.expect("(", '"(" con los argumentos');
    const args: Expr[] = [];
    if (!this.check(")")) {
      do {
        args.push(this.parseExpression());
      } while (this.accept(","));
    }
    this.expect(")", '")" para cerrar los argumentos');
    return { kind: "file", pos: start.pos, op, mode, args };
  }

  private parseAssignOrCall(): Stmt {
    const start = this.current;
    const target = this.parsePostfix();

    if (this.check(":=") || this.check("=")) {
      const opTok = this.next();
      if (opTok.type === "=") {
        this.warn("La asignación se escribe := ; el = es comparación (sintaxis-completa §12).", opTok.pos);
      }
      if (target.kind !== "ident" && target.kind !== "field" && target.kind !== "index") {
        this.error("A la izquierda de := va una variable, un campo o una componente de arreglo.", start.pos);
      }
      const value = this.parseExpression();
      return { kind: "assign", pos: start.pos, target: target as LValue, value };
    }

    if (target.kind === "callExpr") {
      return { kind: "call", pos: start.pos, name: target.callee, args: target.args, hadParens: true };
    }
    if (target.kind === "ident") {
      return { kind: "call", pos: start.pos, name: target.name, args: [], hadParens: false };
    }

    return this.error('Se esperaba ":=" para asignar, o la invocación de un procedimiento.', start.pos);
  }

  // ── expresiones ──────────────────────────────────────────────────────────

  parseExpression(): Expr {
    return this.parseOr();
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.check("O")) {
      const op = this.next();
      const right = this.parseAnd();
      left = { kind: "binary", pos: op.pos, op: "O", left, right };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseRelational();
    while (this.check("Y")) {
      const op = this.next();
      const right = this.parseRelational();
      left = { kind: "binary", pos: op.pos, op: "Y", left, right };
    }
    return left;
  }

  private parseRelational(): Expr {
    const left = this.parseAdditive();
    if (RELATIONAL.has(this.current.type)) {
      const op = this.next();
      // "v EN ('a','e','i')": el conjunto escrito en el lugar. Se desazucara a
      // (v = 'a') O (v = 'e') O (v = 'i'), que es exactamente lo que significa.
      if (op.type === "EN" && this.check("(")) {
        const abre = this.next();
        const valores: Expr[] = [this.parseExpression()];
        while (this.accept(",")) valores.push(this.parseExpression());
        this.expect(")", '")" para cerrar el conjunto');
        if (valores.length === 1) {
          return { kind: "binary", pos: op.pos, op: "EN", left, right: valores[0] };
        }
        return valores
          .map((v): Expr => ({ kind: "binary", pos: abre.pos, op: "=", left, right: v }))
          .reduce((acc, cmp): Expr => ({ kind: "binary", pos: abre.pos, op: "O", left: acc, right: cmp }));
      }
      const right = this.parseAdditive();
      return { kind: "binary", pos: op.pos, op: op.type, left, right };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (this.check("+") || this.check("-")) {
      const op = this.next();
      const right = this.parseMultiplicative();
      left = { kind: "binary", pos: op.pos, op: op.type, left, right };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.check("*") || this.check("/") || this.check("MOD") || this.check("DIV")) {
      const op = this.next();
      const right = this.parseUnary();
      left = { kind: "binary", pos: op.pos, op: op.type, left, right };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.check("-")) {
      const op = this.next();
      return { kind: "unary", pos: op.pos, op: "-", operand: this.parseUnary() };
    }
    if (this.check("NO")) {
      const op = this.next();
      return { kind: "unary", pos: op.pos, op: "NO", operand: this.parseUnary() };
    }
    return this.parsePower();
  }

  private parsePower(): Expr {
    const left = this.parsePostfix();
    if (this.check("**")) {
      const op = this.next();
      const right = this.parseUnary();
      return { kind: "binary", pos: op.pos, op: "**", left, right };
    }
    return left;
  }

  private parsePostfix(): Expr {
    let expr = this.parsePrimary();
    for (;;) {
      if (this.check(".")) {
        const dot = this.next();
        const field = this.current;
        if (field.type === "EOF") this.error("Falta el nombre del campo después del punto.", dot.pos);
        this.next();
        expr = { kind: "field", pos: dot.pos, target: expr, field: field.value || field.raw };
        continue;
      }
      if (this.check("[")) {
        const open = this.next();
        const indices: Expr[] = [this.parseExpression()];
        while (this.accept(",")) indices.push(this.parseExpression());
        this.expect("]", '"]" para cerrar el índice');
        expr = { kind: "index", pos: open.pos, target: expr, indices };
        continue;
      }
      if (this.check("(") && expr.kind === "ident") {
        const open = this.next();
        const args: Expr[] = [];
        if (!this.check(")")) {
          do {
            args.push(this.parseExpression());
          } while (this.accept(","));
        }
        this.expect(")", '")" para cerrar los argumentos');
        expr = { kind: "callExpr", pos: open.pos, callee: expr.name, args };
        continue;
      }
      return expr;
    }
  }

  private parsePrimary(): Expr {
    const tok = this.current;
    switch (tok.type) {
      case "NUMBER": {
        this.next();
        const isReal = (tok as Token & { isReal?: boolean }).isReal === true;
        return { kind: "number", pos: tok.pos, value: Number(tok.value), isReal };
      }
      case "STRING":
        this.next();
        return { kind: "string", pos: tok.pos, value: tok.value };
      case "VERDADERO":
        this.next();
        return { kind: "bool", pos: tok.pos, value: true };
      case "FALSO":
        this.next();
        return { kind: "bool", pos: tok.pos, value: false };
      case "EXISTE":
        this.next();
        return { kind: "existe", pos: tok.pos };
      case "IDENT":
      case "TIPO":
        this.next();
        return { kind: "ident", pos: tok.pos, name: tok.value };
      case "FDA":
      case "NFDA":
      case "FDS":
      case "NFDS":
        this.next();
        return { kind: "ident", pos: tok.pos, name: tok.type };
      case "(": {
        this.next();
        const inner = this.parseExpression();
        this.expect(")", '")" para cerrar el paréntesis');
        return inner;
      }
      default:
        return this.error(
          `Se esperaba un valor y apareció "${tok.raw || tok.type}". Un valor es un número, un texto ` +
            'entre comillas, verdadero/falso, una variable, o una cuenta entre ellos.'
        );
    }
  }
}
