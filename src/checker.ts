import type {
  Declaration,
  Expr,
  Pos,
  Program,
  RecordDecl,
  Stmt,
  SubprogramDecl,
  TypeNode,
} from "./ast";
import { diag, type Diagnostic } from "./diagnostics";
import { enumerar, masParecido } from "./texto";

export const BUILTIN_FUNCTIONS = new Set(["abso", "trunc", "redond"]);
/** predicados de archivo/secuencia: se chequean acá, se ejecutan en la fase 2 */
const FILE_PREDICATES = new Set(["fda", "nfda", "fds", "nfds"]);

interface SymbolInfo {
  name: string;
  type?: TypeNode;
  kind: "var" | "const" | "param" | "counter" | "function";
  pos: Pos;
}

class Scope {
  private symbols = new Map<string, SymbolInfo>();

  constructor(readonly parent?: Scope) {}

  declare(info: SymbolInfo): SymbolInfo | undefined {
    const key = info.name.toLowerCase();
    const previous = this.symbols.get(key);
    this.symbols.set(key, info);
    return previous;
  }

  lookup(name: string): SymbolInfo | undefined {
    return this.symbols.get(name.toLowerCase()) ?? this.parent?.lookup(name);
  }

  has(name: string): boolean {
    return this.symbols.has(name.toLowerCase());
  }

  /** todo lo visible desde acá, para sugerir cuando hay un typo */
  visibles(): string[] {
    const nombres = [...this.symbols.values()].map((s) => s.name);
    return this.parent ? [...nombres, ...this.parent.visibles()] : nombres;
  }
}

export function check(program: Program): Diagnostic[] {
  return new Checker(program).run();
}

class Checker {
  private diagnostics: Diagnostic[] = [];
  private types = new Map<string, RecordDecl>();
  private subprograms = new Map<string, SubprogramDecl>();
  private global = new Scope();
  private assigned = new Set<string>();
  private used = new Set<string>();
  /** variables asignadas alguna vez sin depender de su valor anterior */
  private inicializados = new Set<string>();
  private acumuladores = new Map<string, { nombre: string; pos: Pos }>();

  constructor(private program: Program) {}

  // Las dos notaciones (FIN_SI / FinSi, Proceso / Algoritmo) son válidas para la
  // cátedra, y sus propios materiales las mezclan: el libro y las filminas usan
  // una, las resoluciones de la guía usan la otra, y los parciales resueltos en
  // clase mezclan las dos. Por eso acá no se avisa nada al respecto.
  run(): Diagnostic[] {
    if (this.program.name.includes(".")) {
      this.warn(
        this.program.namePos,
        `El nombre de la ACCION no lleva puntos ni espacios: "${this.program.name}" iría como "${this.program.name.replace(/\./g, "_")}" (errores-y-trampas #26).`
      );
    }
    this.collectDeclarations(this.program.declarations, this.global);

    for (const decl of this.program.declarations) {
      if (decl.kind === "subprogram") this.checkSubprogram(decl);
    }
    this.checkStatements(this.program.body, this.global);

    this.reportUnassigned();
    this.reportSinInicializar();
    this.diagnostics.sort((a, b) => a.pos.offset - b.pos.offset);
    return this.diagnostics;
  }

  // ── declaraciones ────────────────────────────────────────────────────────

  private collectDeclarations(decls: Declaration[], scope: Scope): void {
    // primero los REGISTRO: una variable puede usar un tipo declarado más abajo
    for (const decl of decls) {
      if (decl.kind !== "record") continue;
      const key = decl.name.toLowerCase();
      if (this.types.has(key)) {
        this.warn(decl.pos, `El registro "${decl.name}" ya estaba declarado.`);
      }
      this.types.set(key, decl);
    }
    for (const decl of decls) {
      switch (decl.kind) {
        case "record": {
          for (const field of decl.fields) this.checkTypeRef(field.type);
          break;
        }
        case "const": {
          const previous = scope.declare({ name: decl.name, kind: "const", pos: decl.pos });
          if (previous) this.warn(decl.pos, `"${decl.name}" ya estaba declarada.`);
          this.assigned.add(decl.name.toLowerCase());
          break;
        }
        case "var": {
          this.checkTypeRef(decl.type);
          for (const name of decl.names) {
            const previous = scope.declare({ name, type: decl.type, kind: "var", pos: decl.pos });
            if (previous) this.warn(decl.pos, `"${name}" ya estaba declarada.`);
            // archivos y secuencias se "asignan" al leerlos/abrirlos
            if (decl.type.kind === "archivo" || decl.type.kind === "secuencia") {
              this.assigned.add(name.toLowerCase());
            }
          }
          break;
        }
        case "subprogram": {
          const key = decl.name.toLowerCase();
          if (this.subprograms.has(key)) {
            this.warn(decl.pos, `"${decl.name}" ya estaba declarado.`);
          }
          this.subprograms.set(key, decl);
          scope.declare({ name: decl.name, type: decl.returnType, kind: "function", pos: decl.pos });
          this.assigned.add(key);
          break;
        }
      }
    }
  }

  private checkTypeRef(type: TypeNode): void {
    switch (type.kind) {
      case "named":
        if (!this.types.has(type.name.toLowerCase())) {
          const parecido = masParecido(
            type.name,
            [...this.types.values()].map((r) => r.name)
          );
          this.error(
            type.pos,
            `El tipo "${type.name}" no está declarado como REGISTRO en el Ambiente.` +
              (parecido ? ` ¿Quisiste escribir "${parecido}"?` : "")
          );
        }
        break;
      case "array":
        for (const dim of type.dims) {
          if (dim.low > dim.high) {
            this.error(type.pos, `Los límites del arreglo están al revés: [${dim.low}..${dim.high}].`);
          }
        }
        this.checkTypeRef(type.element);
        break;
      case "archivo":
      case "secuencia":
        this.checkTypeRef(type.element);
        break;
      case "subrange":
        if (type.low > type.high) {
          this.error(type.pos, `Los límites del subrango están al revés: ${type.low}..${type.high}.`);
        }
        break;
      default:
        break;
    }
  }

  private checkSubprogram(sub: SubprogramDecl): void {
    const scope = new Scope(this.global);
    for (const param of sub.params) {
      this.checkTypeRef(param.type);
      scope.declare({ name: param.name, type: param.type, kind: "param", pos: param.pos });
      this.assigned.add(param.name.toLowerCase());
    }
    this.collectDeclarations(sub.locals, scope);
    for (const local of sub.locals) {
      if (local.kind === "subprogram") this.checkSubprogram(local);
    }
    if (sub.isFunction) {
      scope.declare({ name: sub.name, type: sub.returnType, kind: "var", pos: sub.pos });
      if (!this.assignsOwnName(sub)) {
        this.warn(
          sub.pos,
          `La función "${sub.name}" nunca asigna su resultado: el retorno se asigna al nombre de la función (${sub.name} := ...).`
        );
      }
    }
    this.checkStatements(sub.body, scope);
  }

  /**
   * Un MIENTRAS cuya condición mira variables que el cuerpo nunca toca no termina
   * jamás. Se descarta el análisis si hay llamadas a subacciones, archivos o
   * secuencias de por medio, porque ahí el valor puede cambiar sin verse acá.
   */
  private avisarCicloSinSalida(stmt: Extract<Stmt, { kind: "while" }>): void {
    const mirados = new Set<string>();
    if (!variablesDeLaCondicion(stmt.cond, mirados) || mirados.size === 0) return;

    const tocados = new Set<string>();
    if (!variablesQueCambian(stmt.body, tocados)) return;

    const sinTocar = [...mirados].filter((nombre) => !tocados.has(nombre));
    if (sinTocar.length !== mirados.size) return;

    const lista = sinTocar.map((n) => `"${n}"`).join(", ");
    this.warn(
      stmt.pos,
      `Este MIENTRAS no termina nunca: la condición depende de ${lista}, y adentro del ciclo nada lo cambia. ` +
        "Falta la instrucción que hace avanzar la condición (leer el próximo dato, incrementar el contador, apagar el flag)."
    );
  }

  private assignsOwnName(sub: SubprogramDecl): boolean {
    const target = sub.name.toLowerCase();
    let found = false;
    const visit = (stmts: Stmt[]): void => {
      for (const stmt of stmts) {
        if (found) return;
        switch (stmt.kind) {
          case "assign":
            if (stmt.target.kind === "ident" && stmt.target.name.toLowerCase() === target) found = true;
            break;
          case "if":
            visit(stmt.then);
            if (stmt.else) visit(stmt.else);
            break;
          case "segun":
            for (const branch of stmt.branches) visit(branch.body);
            break;
          case "while":
          case "repeat":
          case "for":
            visit(stmt.body);
            break;
          default:
            break;
        }
      }
    };
    visit(sub.body);
    return found;
  }

  // ── sentencias ───────────────────────────────────────────────────────────

  private checkStatements(stmts: Stmt[], scope: Scope): void {
    // valores que se conocen con certeza en esta secuencia de instrucciones:
    // sirven para avisar de un ciclo que no arranca nunca
    const conocidos = new Map<string, number | string | boolean>();
    for (const stmt of stmts) this.checkStatement(stmt, scope, conocidos);
  }

  private checkStatement(stmt: Stmt, scope: Scope, conocidos = new Map<string, number | string | boolean>()): void {
    switch (stmt.kind) {
      case "assign": {
        const target = stmt.target;
        const root = rootName(target);
        if (root) {
          const symbol = scope.lookup(root);
          if (symbol?.kind === "const") {
            this.error(stmt.pos, `"${root}" es una constante: no se le puede asignar un valor.`);
          }
          this.assigned.add(root.toLowerCase());
        }
        this.checkExpr(target, scope);
        this.checkExpr(stmt.value, scope);
        if (target.kind === "ident") {
          const clave = target.name.toLowerCase();
          if (usaVariable(stmt.value, clave)) {
            if (!this.acumuladores.has(clave)) {
              this.acumuladores.set(clave, { nombre: target.name, pos: stmt.pos });
            }
          } else {
            this.inicializados.add(clave);
          }
          const literal = literalDe(stmt.value);
          if (literal === undefined) conocidos.delete(target.name.toLowerCase());
          else conocidos.set(target.name.toLowerCase(), literal);
        } else if (root) {
          conocidos.delete(root.toLowerCase());
        }
        break;
      }
      case "if":
        this.checkExpr(stmt.cond, scope);
        this.checkStatements(stmt.then, scope);
        if (stmt.else) this.checkStatements(stmt.else, scope);
        conocidos.clear();
        break;
      case "segun":
        this.checkExpr(stmt.subject, scope);
        for (const branch of stmt.branches) this.checkStatements(branch.body, scope);
        break;
      case "while": {
        this.checkExpr(stmt.cond, scope);
        const veredicto = evaluarCondicion(stmt.cond, conocidos);
        if (veredicto?.valor === false) {
          this.warn(
            stmt.pos,
            `Este MIENTRAS no se ejecuta ni una vez: al llegar acá ${veredicto.detalle}. ` +
              "Revisá la condición (¿va al revés?) o el valor con el que arranca."
          );
        } else {
          this.avisarCicloSinSalida(stmt);
        }
        this.checkStatements(stmt.body, scope);
        conocidos.clear();
        break;
      }
      case "repeat":
        this.checkStatements(stmt.body, scope);
        this.checkExpr(stmt.cond, scope);
        conocidos.clear();
        break;
      case "for": {
        const desde = literalDe(stmt.from);
        const hasta = literalDe(stmt.to);
        const paso = stmt.step ? literalDe(stmt.step) : 1;
        if (typeof desde === "number" && typeof hasta === "number" && typeof paso === "number" && paso !== 0) {
          const daVueltas = paso > 0 ? desde <= hasta : desde >= hasta;
          if (!daVueltas) {
            this.warn(
              stmt.pos,
              `Este PARA no se ejecuta ni una vez: va de ${desde} a ${hasta} con incremento ${paso}. ` +
                (paso > 0 ? "Para contar hacia atrás el incremento va negativo: PARA i := " + desde + " HASTA " + hasta + ", -1 HACER" : "")
            );
          }
        }
        scope.declare({ name: stmt.counter, kind: "counter", pos: stmt.pos, type: { kind: "scalar", name: "entero", pos: stmt.pos } });
        this.assigned.add(stmt.counter.toLowerCase());
        this.inicializados.add(stmt.counter.toLowerCase());
        this.checkExpr(stmt.from, scope);
        this.checkExpr(stmt.to, scope);
        if (stmt.step) this.checkExpr(stmt.step, scope);
        this.checkStatements(stmt.body, scope);
        conocidos.clear();
        break;
      }
      case "io": {
        for (const arg of stmt.args) this.checkExpr(arg, scope);
        if (stmt.op === "LEER") {
          // LEER(arch, reg) carga reg; LEER(a, b) carga a y b
          for (const arg of stmt.args) {
            const root = rootName(arg);
            if (root) {
              this.assigned.add(root.toLowerCase());
              this.inicializados.add(root.toLowerCase());
              conocidos.delete(root.toLowerCase());
            }
          }
        }
        break;
      }
      case "call": {
        const sub = this.subprograms.get(stmt.name.toLowerCase());
        if (!sub) {
          const parecido = masParecido(
            stmt.name,
            [...this.subprograms.values()].map((s) => s.name)
          );
          const variable = scope.lookup(stmt.name);
          this.error(
            stmt.pos,
            parecido
              ? `El procedimiento "${stmt.name}" no está declarado. ¿Quisiste escribir "${parecido}"?`
              : variable
                ? `"${stmt.name}" es una variable, no un procedimiento. Para darle un valor va "${stmt.name} := ...".`
                : `El procedimiento "${stmt.name}" no está declarado en el Ambiente de la ACCION.`
          );
          break;
        }
        if (sub.isFunction) {
          this.warn(stmt.pos, `"${stmt.name}" es una FUNCION: se invoca dentro de una expresión, no como instrucción suelta.`);
        }
        if (stmt.hadParens && sub.params.length === 0) {
          this.info(stmt.pos, `Un procedimiento sin parámetros se invoca por su nombre solo: "${stmt.name}".`);
        }
        if (stmt.args.length !== sub.params.length) {
          this.error(
            stmt.pos,
            `"${stmt.name}" espera ${sub.params.length} parámetro(s) y recibió ${stmt.args.length}.`
          );
        }
        for (const arg of stmt.args) this.checkExpr(arg, scope);
        conocidos.clear();
        sub.params.forEach((param, idx) => {
          if (!param.byRef) return;
          const arg = stmt.args[idx];
          if (!arg) return;
          const root = rootName(arg);
          if (!root) {
            this.error(arg.pos, `El parámetro "${param.name}" es por referencia (var): hay que pasarle una variable.`);
          } else {
            this.assigned.add(root.toLowerCase());
            this.inicializados.add(root.toLowerCase());
          }
        });
        break;
      }
      case "file": {
        for (const arg of stmt.args) this.checkExpr(arg, scope);
        for (const arg of stmt.args) {
          const root = rootName(arg);
          if (root) {
            this.assigned.add(root.toLowerCase());
            this.inicializados.add(root.toLowerCase());
          }
        }
        break;
      }
    }
  }

  // ── expresiones ──────────────────────────────────────────────────────────

  private checkExpr(expr: Expr, scope: Scope): TypeNode | undefined {
    switch (expr.kind) {
      case "number":
      case "string":
      case "bool":
      case "existe":
        return undefined;
      case "ident": {
        if (FILE_PREDICATES.has(expr.name.toLowerCase())) return undefined;
        const symbol = scope.lookup(expr.name);
        if (!symbol) {
          const parecida = masParecido(expr.name, scope.visibles());
          this.error(
            expr.pos,
            `"${expr.name}" no está declarada en el Ambiente.` +
              (parecida
                ? ` ¿Quisiste escribir "${parecida}"?`
                : " Agregala arriba, en el Ambiente, con su tipo: " + `${expr.name} : entero`)
          );
          return undefined;
        }
        // una subacción nombrada sin paréntesis no es un valor
        if (symbol.kind === "function") {
          const sub = this.subprograms.get(expr.name.toLowerCase());
          if (sub?.isFunction) {
            this.error(
              expr.pos,
              `"${expr.name}" es una FUNCION: para usar su resultado hay que invocarla con sus parámetros, ` +
                `${expr.name}(${sub.params.map((p) => p.name).join(", ")}).`
            );
          } else if (sub) {
            this.error(
              expr.pos,
              `"${expr.name}" es un PROCEDIMIENTO: no devuelve ningún valor, así que no puede usarse dentro de una expresión. ` +
                `Se invoca solo, en su propia línea: ${expr.name}${sub.params.length ? "(...)" : ""}.`
            );
          }
          return undefined;
        }
        this.used.add(expr.name.toLowerCase());
        return symbol.type;
      }
      case "field": {
        const targetType = this.checkExpr(expr.target, scope);
        const record = this.resolveRecord(targetType);
        if (!record) return undefined;
        const field = record.fields.find((f) => f.name.toLowerCase() === expr.field.toLowerCase());
        if (!field) {
          const parecido = masParecido(expr.field, record.fields.map((f) => f.name));
          this.error(
            expr.pos,
            `El registro "${record.name}" no tiene un campo "${expr.field}".` +
              (parecido ? ` ¿Quisiste escribir "${parecido}"?` : "") +
              ` Sus campos son ${enumerar(record.fields.map((f) => f.name))} (errores-y-trampas #10).`,
            [{ pos: record.pos, message: `Acá se declara el registro "${record.name}".` }]
          );
          return undefined;
        }
        return field.type;
      }
      case "index": {
        const targetType = this.checkExpr(expr.target, scope);
        for (const idx of expr.indices) this.checkExpr(idx, scope);
        if (!targetType) return undefined;
        if (targetType.kind !== "array") {
          this.error(expr.pos, "Solo se pueden indexar arreglos con [ ].");
          return undefined;
        }
        if (expr.indices.length !== targetType.dims.length) {
          this.error(
            expr.pos,
            `El arreglo tiene ${targetType.dims.length} dimensión(es) y se lo indexó con ${expr.indices.length}.`
          );
          return undefined;
        }
        expr.indices.forEach((idx, i) => {
          const dim = targetType.dims[i];
          if (idx.kind === "number" && (idx.value < dim.low || idx.value > dim.high)) {
            this.error(idx.pos, `El índice ${idx.value} queda fuera del rango declarado [${dim.low}..${dim.high}].`);
          }
        });
        return targetType.element;
      }
      case "callExpr": {
        for (const arg of expr.args) this.checkExpr(arg, scope);
        const key = expr.callee.toLowerCase();
        if (FILE_PREDICATES.has(key) || BUILTIN_FUNCTIONS.has(key)) return undefined;
        const sub = this.subprograms.get(key);
        if (sub && !sub.isFunction) {
          this.error(
            expr.pos,
            `"${expr.callee}" es un PROCEDIMIENTO: no devuelve ningún valor. ` +
              "Si tiene que devolver algo, declaralo como FUNCION; si no, invocalo en su propia línea."
          );
          return undefined;
        }
        if (!sub) {
          const parecida = masParecido(expr.callee, [
            ...[...this.subprograms.values()].map((s) => s.name),
            ...BUILTIN_FUNCTIONS,
          ]);
          this.error(
            expr.pos,
            `La función "${expr.callee}" no está declarada en el Ambiente.` +
              (parecida ? ` ¿Quisiste escribir "${parecida}"?` : "")
          );
          return undefined;
        }
        if (expr.args.length !== sub.params.length) {
          this.error(
            expr.pos,
            `"${expr.callee}" espera ${sub.params.length} parámetro(s) y recibió ${expr.args.length}.`
          );
        }
        this.used.add(key);
        return sub.returnType;
      }
      case "unary":
        this.checkExpr(expr.operand, scope);
        return undefined;
      case "binary":
        this.checkExpr(expr.left, scope);
        this.checkExpr(expr.right, scope);
        return undefined;
    }
  }

  private resolveRecord(type: TypeNode | undefined): RecordDecl | undefined {
    if (!type) return undefined;
    if (type.kind === "named") return this.types.get(type.name.toLowerCase());
    if (type.kind === "archivo" || type.kind === "secuencia") return this.resolveRecord(type.element);
    return undefined;
  }

  // ── reportes finales ─────────────────────────────────────────────────────

  /** variables que solo se asignan en función de sí mismas: nunca arrancan en un valor */
  private reportSinInicializar(): void {
    for (const [clave, info] of this.acumuladores) {
      if (this.inicializados.has(clave)) continue;
      this.warn(
        info.pos,
        `"${info.nombre}" se acumula sobre su propio valor, pero nunca se le dio un valor inicial: agregá ${info.nombre} := 0 antes de empezar a acumular (errores-y-trampas #14).`
      );
    }
  }

  private reportUnassigned(): void {
    const seen = new Set<string>();
    const visitScopeDecls = (decls: Declaration[]): void => {
      for (const decl of decls) {
        if (decl.kind === "var") {
          for (const name of decl.names) {
            const key = name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            if (this.used.has(key) && !this.assigned.has(key)) {
              this.warn(
                decl.pos,
                `"${name}" se usa en un cálculo pero nunca se le asigna valor (ni con := ni con LEER) — errores-y-trampas #14.`
              );
            }
          }
        }
        if (decl.kind === "subprogram") visitScopeDecls(decl.locals);
      }
    };
    visitScopeDecls(this.program.declarations);
  }

  private error(pos: Pos, message: string, related?: Diagnostic["related"]): void {
    this.diagnostics.push(diag(pos, message, "error", related));
  }

  private warn(pos: Pos, message: string, related?: Diagnostic["related"]): void {
    this.diagnostics.push(diag(pos, message, "warning", related));
  }

  private info(pos: Pos, message: string): void {
    this.diagnostics.push(diag(pos, message, "info"));
  }
}

/** ¿la expresión usa esta variable? */
function usaVariable(expr: Expr, clave: string): boolean {
  switch (expr.kind) {
    case "ident":
      return expr.name.toLowerCase() === clave;
    case "field":
    case "index":
      return usaVariable(expr.target, clave);
    case "unary":
      return usaVariable(expr.operand, clave);
    case "binary":
      return usaVariable(expr.left, clave) || usaVariable(expr.right, clave);
    case "callExpr":
      return expr.args.some((arg) => usaVariable(arg, clave));
    default:
      return false;
  }
}

/**
 * Junta las variables de una condición. Devuelve false si la condición depende de
 * algo que no se puede seguir desde acá (una función, un archivo, una secuencia).
 */
function variablesDeLaCondicion(expr: Expr, salida: Set<string>): boolean {
  switch (expr.kind) {
    case "number":
    case "string":
    case "bool":
      return true;
    case "ident": {
      const nombre = expr.name.toLowerCase();
      if (FILE_PREDICATES.has(nombre)) return false;
      salida.add(nombre);
      return true;
    }
    case "field":
    case "index":
      return variablesDeLaCondicion(expr.target, salida);
    case "unary":
      return variablesDeLaCondicion(expr.operand, salida);
    case "binary":
      return (
        variablesDeLaCondicion(expr.left, salida) && variablesDeLaCondicion(expr.right, salida)
      );
    default:
      // llamadas a función, EXISTE, FDA/NFDA: el valor puede cambiar sin que se vea acá
      return false;
  }
}

/**
 * Junta las variables que el cuerpo del ciclo modifica. Devuelve false si hay algo
 * que podría modificar cualquier cosa (una llamada, un archivo, una secuencia).
 */
function variablesQueCambian(stmts: Stmt[], salida: Set<string>): boolean {
  for (const stmt of stmts) {
    switch (stmt.kind) {
      case "assign": {
        const root = rootName(stmt.target);
        if (root) salida.add(root.toLowerCase());
        break;
      }
      case "io": {
        if (stmt.op === "LEER") {
          for (const arg of stmt.args) {
            const root = rootName(arg);
            if (root) salida.add(root.toLowerCase());
          }
        }
        break;
      }
      case "if":
        if (!variablesQueCambian(stmt.then, salida)) return false;
        if (stmt.else && !variablesQueCambian(stmt.else, salida)) return false;
        break;
      case "segun":
        for (const branch of stmt.branches) {
          if (!variablesQueCambian(branch.body, salida)) return false;
        }
        break;
      case "while":
      case "repeat":
      case "for":
        if (!variablesQueCambian(stmt.body, salida)) return false;
        break;
      default:
        // call / file: pueden tocar variables globales sin que se note
        return false;
    }
  }
  return true;
}

/** valor literal de una expresión, si se puede saber sin ejecutar nada */
function literalDe(expr: Expr): number | string | boolean | undefined {
  if (expr.kind === "number" || expr.kind === "string" || expr.kind === "bool") return expr.value;
  if (expr.kind === "unary" && expr.op === "-") {
    const interno = literalDe(expr.operand);
    return typeof interno === "number" ? -interno : undefined;
  }
  return undefined;
}

/** decide una comparación simple entre una variable de valor conocido y un literal */
function evaluarCondicion(
  cond: Expr,
  conocidos: Map<string, number | string | boolean>
): { valor: boolean; detalle: string } | undefined {
  if (cond.kind !== "binary") return undefined;
  const comparaciones = ["=", "<>", "<", "<=", ">", ">="];
  if (!comparaciones.includes(cond.op)) return undefined;

  const izq = cond.left;
  const der = cond.right;
  let nombre: string | undefined;
  let valor: number | string | boolean | undefined;
  let limite: number | string | boolean | undefined;
  let op = cond.op;

  if (izq.kind === "ident" && conocidos.has(izq.name.toLowerCase())) {
    nombre = izq.name;
    valor = conocidos.get(izq.name.toLowerCase());
    limite = literalDe(der);
  } else if (der.kind === "ident" && conocidos.has(der.name.toLowerCase())) {
    nombre = der.name;
    valor = conocidos.get(der.name.toLowerCase());
    limite = literalDe(izq);
    op = { "<": ">", "<=": ">=", ">": "<", ">=": "<=" }[op] ?? op;
  }

  if (nombre === undefined || valor === undefined || limite === undefined) return undefined;
  if (typeof valor !== typeof limite) return undefined;

  let resultado: boolean;
  switch (op) {
    case "=":
      resultado = valor === limite;
      break;
    case "<>":
      resultado = valor !== limite;
      break;
    case "<":
      resultado = valor < limite;
      break;
    case "<=":
      resultado = valor <= limite;
      break;
    case ">":
      resultado = valor > limite;
      break;
    default:
      resultado = valor >= limite;
  }

  return {
    valor: resultado,
    detalle: `"${nombre}" vale ${JSON.stringify(valor)} y la condición pide ${nombre} ${op} ${JSON.stringify(limite)}`,
  };
}

function rootName(expr: Expr): string | undefined {
  switch (expr.kind) {
    case "ident":
      return expr.name;
    case "field":
    case "index":
      return rootName(expr.target);
    default:
      return undefined;
  }
}
