import {
  ArrayVal,
  CancelledError,
  RecordVal,
  RuntimeError,
  cloneValue,
  formatValue,
  type Value,
} from "./valores";
export { ArrayVal, CancelledError, RecordVal, RuntimeError, formatValue, type Value } from "./valores";
import { ArchivoAbierto, SecuenciaAbierta, columnasDe, type SistemaDeArchivos } from "./archivos";
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

export interface Host {
  /** una línea de ESCRIBIR */
  write(text: string): void;
  /** LEER por teclado */
  readLine(): Promise<string>;
  isCancelled?(): boolean;
  /** de dónde salen los datos de los ARCHIVO y las SECUENCIA */
  archivos?: SistemaDeArchivos;
}

class Cell {
  /** con `slot` la celda es un alias: así funciona el pasaje por referencia (var) */
  constructor(
    private ownValue: Value,
    readonly type?: TypeNode,
    private slot?: Slot
  ) {}

  get value(): Value {
    return this.slot ? this.slot.get() : this.ownValue;
  }

  set value(next: Value) {
    if (this.slot) this.slot.set(next);
    else this.ownValue = next;
  }
}

class Env {
  private cells = new Map<string, Cell>();

  constructor(readonly parent?: Env) {}

  define(name: string, cell: Cell): void {
    this.cells.set(name.toLowerCase(), cell);
  }

  lookup(name: string): Cell | undefined {
    return this.cells.get(name.toLowerCase()) ?? this.parent?.lookup(name);
  }
}

interface Slot {
  get(): Value;
  set(value: Value): void;
  type?: TypeNode;
}

export interface RunOptions {
  /** corta la ejecución si se pasa: casi siempre es un ciclo infinito */
  maxSteps?: number;
}

export async function run(program: Program, host: Host, options: RunOptions = {}): Promise<void> {
  await new Interpreter(program, host, options.maxSteps ?? 20_000_000).run();
}

class Interpreter {
  private types = new Map<string, RecordDecl>();
  private subprograms = new Map<string, SubprogramDecl>();
  private globals = new Env();
  private steps = 0;
  /** resultado del último LEER sobre un archivo indexado, para SI EXISTE */
  private existe: boolean | undefined;

  constructor(
    private program: Program,
    private host: Host,
    private maxSteps: number
  ) {}

  async run(): Promise<void> {
    this.declare(this.program.declarations, this.globals);
    await this.execBlock(this.program.body, this.globals);
  }

  // ── declaraciones ────────────────────────────────────────────────────────

  private declare(decls: Declaration[], env: Env): void {
    for (const decl of decls) {
      if (decl.kind === "record") this.types.set(decl.name.toLowerCase(), decl);
      if (decl.kind === "subprogram") this.subprograms.set(decl.name.toLowerCase(), decl);
    }
    for (const decl of decls) {
      switch (decl.kind) {
        case "const":
          env.define(decl.name, new Cell(this.evalConst(decl.value)));
          break;
        case "var":
          for (const name of decl.names) {
            env.define(name, new Cell(this.defaultValue(decl.type, name), decl.type));
          }
          break;
        default:
          break;
      }
    }
  }

  private evalConst(expr: Expr): Value {
    switch (expr.kind) {
      case "number":
        return expr.value;
      case "string":
        return expr.value;
      case "bool":
        return expr.value;
      case "unary":
        if (expr.op === "-") return -(this.evalConst(expr.operand) as number);
        return !truthy(this.evalConst(expr.operand), expr.pos);
      case "binary": {
        const left = this.evalConst(expr.left);
        const right = this.evalConst(expr.right);
        return applyBinary(expr.op, left, right, expr.pos, this.types);
      }
      default:
        throw new RuntimeError("El valor de una constante tiene que ser un literal.", expr.pos);
    }
  }

  private defaultValue(type: TypeNode, name = ""): Value {
    switch (type.kind) {
      case "scalar":
        if (type.name === "entero" || type.name === "real") return 0;
        if (type.name === "logico") return false;
        return "";
      case "text":
        return "";
      case "numeric":
        return 0;
      case "subrange":
        if (type.high < type.low) {
          throw new RuntimeError(
            `El subrango${name ? ` de "${name}"` : ""} está al revés: ${type.low}..${type.high}. ` +
              `Va del menor al mayor: ${type.high}..${type.low}.`,
            type.pos
          );
        }
        return type.low;
      case "enum":
        return type.values[0] ?? "";
      case "array": {
        let size = 1;
        for (const dim of type.dims) {
          if (dim.high < dim.low) {
            throw new RuntimeError(
              `Los límites del arreglo${name ? ` "${name}"` : ""} están al revés: [${dim.low}..${dim.high}]. ` +
                `Va del menor al mayor: [${dim.high}..${dim.low}].`,
              type.pos
            );
          }
          size *= dim.high - dim.low + 1;
        }
        const data: Value[] = new Array(size);
        for (let i = 0; i < size; i++) data[i] = this.defaultValue(type.element);
        return new ArrayVal(type.dims, data);
      }
      case "named": {
        const record = this.types.get(type.name.toLowerCase());
        if (!record) throw new RuntimeError(`El tipo "${type.name}" no está declarado.`, type.pos);
        const fields = new Map<string, Value>();
        for (const field of record.fields) fields.set(field.name.toLowerCase(), this.defaultValue(field.type));
        return new RecordVal(record.name, fields);
      }
      case "archivo": {
        const registro =
          type.element.kind === "named" ? this.types.get(type.element.name.toLowerCase()) : undefined;
        const columnas = registro ? columnasDe(type.element, this.types, [], type.pos) : [];
        const archivo = new ArchivoAbierto(name, registro, columnas, () =>
          registro ? (this.defaultValue(type.element) as RecordVal) : new RecordVal("", new Map())
        );
        archivo.indexadoPor = [...type.indexedBy];
        return archivo;
      }
      case "secuencia": {
        const esCaracter =
          type.element.kind === "text" ||
          (type.element.kind === "scalar" &&
            (type.element.name === "caracter" || type.element.name === "alfanumerico"));
        return new SecuenciaAbierta(name, esCaracter);
      }
    }
  }

  private fieldType(record: RecordDecl, field: string): TypeNode | undefined {
    return record.fields.find((f) => f.name.toLowerCase() === field.toLowerCase())?.type;
  }

  // ── sentencias ───────────────────────────────────────────────────────────

  private tick(pos?: Pos): void {
    if (this.host.isCancelled?.()) throw new CancelledError();
    if (++this.steps > this.maxSteps) {
      throw new RuntimeError(
        `El programa superó ${this.maxSteps.toLocaleString("es-AR")} instrucciones: casi seguro hay un ciclo infinito ` +
          "(revisá el AVZ que supera el delimitador, la guarda NFDS/NFDA, o el LEER al final del ciclo).",
        pos
      );
    }
  }

  private async execBlock(stmts: Stmt[], env: Env): Promise<void> {
    for (const stmt of stmts) await this.exec(stmt, env);
  }

  private async exec(stmt: Stmt, env: Env): Promise<void> {
    this.tick(stmt.pos);
    switch (stmt.kind) {
      case "assign": {
        const slot = await this.resolveSlot(stmt.target, env);
        const value = await this.eval(stmt.value, env);
        slot.set(this.coerce(value, slot.type, stmt.pos, describe(stmt.target)));
        return;
      }
      case "if": {
        const cond = truthy(await this.eval(stmt.cond, env), stmt.cond.pos);
        if (cond) await this.execBlock(stmt.then, env);
        else if (stmt.else) await this.execBlock(stmt.else, env);
        return;
      }
      case "segun": {
        const subject = await this.eval(stmt.subject, env);
        let fallback: Stmt[] | undefined;
        for (const branch of stmt.branches) {
          if (branch.labels.length === 0) {
            fallback = branch.body;
            continue;
          }
          for (const label of branch.labels) {
            const value = await this.eval(label, env);
            if (looseEquals(subject, value, this.types)) {
              await this.execBlock(branch.body, env);
              return;
            }
          }
        }
        if (fallback) await this.execBlock(fallback, env);
        return;
      }
      case "while": {
        while (truthy(await this.eval(stmt.cond, env), stmt.cond.pos)) {
          this.tick(stmt.pos);
          await this.execBlock(stmt.body, env);
        }
        return;
      }
      case "repeat": {
        for (;;) {
          this.tick(stmt.pos);
          await this.execBlock(stmt.body, env);
          if (truthy(await this.eval(stmt.cond, env), stmt.cond.pos)) return;
        }
      }
      case "for": {
        const from = numeric(await this.eval(stmt.from, env), stmt.from.pos);
        const to = numeric(await this.eval(stmt.to, env), stmt.to.pos);
        const step = stmt.step ? numeric(await this.eval(stmt.step, env), stmt.step.pos) : 1;
        if (step === 0) throw new RuntimeError("El incremento del PARA no puede ser 0.", stmt.pos);
        let cell = env.lookup(stmt.counter);
        if (!cell) {
          cell = new Cell(from);
          env.define(stmt.counter, cell);
        }
        for (let i = from; step > 0 ? i <= to : i >= to; i += step) {
          this.tick(stmt.pos);
          cell.value = i;
          await this.execBlock(stmt.body, env);
        }
        return;
      }
      case "io":
        await this.execIo(stmt, env);
        return;
      case "call": {
        const sub = this.subprograms.get(stmt.name.toLowerCase());
        if (!sub) throw new RuntimeError(`El procedimiento "${stmt.name}" no está declarado.`, stmt.pos);
        await this.invoke(sub, stmt.args, env, stmt.pos);
        return;
      }
      case "file":
        await this.execFile(stmt, env);
        return;
    }
  }

  private get fs(): SistemaDeArchivos {
    if (!this.host.archivos) {
      throw new RuntimeError(
        "Para usar archivos o secuencias hace falta guardar el algoritmo en un archivo, así los datos se buscan al lado."
      );
    }
    return this.host.archivos;
  }

  private async recurso(expr: Expr, env: Env, pos: Pos): Promise<ArchivoAbierto | SecuenciaAbierta> {
    const valor = await this.eval(expr, env);
    if (valor instanceof ArchivoAbierto || valor instanceof SecuenciaAbierta) return valor;
    throw new RuntimeError(
      `"${describe(expr)}" no es un ARCHIVO ni una SECUENCIA: revisá cómo está declarado en el Ambiente.`,
      pos
    );
  }

  private async execFile(stmt: Extract<Stmt, { kind: "file" }>, env: Env): Promise<void> {
    switch (stmt.op) {
      case "ABRIR": {
        for (const arg of stmt.args) {
          const recurso = await this.recurso(arg, env, stmt.pos);
          if (!(recurso instanceof ArchivoAbierto)) {
            throw new RuntimeError(
              `"${describe(arg)}" es una SECUENCIA: se arranca con ARR(...) o se crea con CREAR(...), no con ABRIR.`,
              stmt.pos
            );
          }
          recurso.abrir(stmt.mode ?? "E", this.fs, stmt.pos);
        }
        return;
      }
      case "CERRAR": {
        for (const arg of stmt.args) {
          const recurso = await this.recurso(arg, env, stmt.pos);
          recurso.cerrar(this.fs);
        }
        return;
      }
      case "ARR": {
        for (const arg of stmt.args) {
          const recurso = await this.recurso(arg, env, stmt.pos);
          if (!(recurso instanceof SecuenciaAbierta)) {
            throw new RuntimeError(
              `"${describe(arg)}" es un ARCHIVO: se abre con ABRIR E/(...), no con ARR.`,
              stmt.pos
            );
          }
          recurso.arrancar(this.fs, stmt.pos);
        }
        return;
      }
      case "CREAR": {
        for (const arg of stmt.args) {
          const recurso = await this.recurso(arg, env, stmt.pos);
          if (!(recurso instanceof SecuenciaAbierta)) {
            throw new RuntimeError(`CREAR es para secuencias; "${describe(arg)}" no lo es.`, stmt.pos);
          }
          recurso.crear(stmt.pos);
        }
        return;
      }
      case "AVZ": {
        const [secExpr, destinoExpr] = stmt.args;
        if (!secExpr || !destinoExpr) {
          throw new RuntimeError("AVZ va con la secuencia y la variable ventana: AVZ(sec, v).", stmt.pos);
        }
        const recurso = await this.recurso(secExpr, env, stmt.pos);
        if (!(recurso instanceof SecuenciaAbierta)) {
          throw new RuntimeError(`"${describe(secExpr)}" no es una SECUENCIA.`, stmt.pos);
        }
        const valor = recurso.avanzar(stmt.pos);
        if (valor !== undefined) {
          const slot = await this.resolveSlot(destinoExpr, env);
          slot.set(this.coerce(valor, slot.type, stmt.pos, describe(destinoExpr)));
        }
        return;
      }
      case "RE-ESCRIBIR":
      case "ELIMINAR": {
        const [archExpr, regExpr] = stmt.args;
        if (!archExpr || !regExpr) {
          throw new RuntimeError(
            `${stmt.op} va con el archivo y el registro: ${stmt.op}(arch, reg).`,
            stmt.pos
          );
        }
        const recurso = await this.recurso(archExpr, env, stmt.pos);
        if (!(recurso instanceof ArchivoAbierto) || !recurso.esIndexado) {
          throw new RuntimeError(
            `${stmt.op} es para archivos declarados INDEXADO por una clave.`,
            stmt.pos
          );
        }
        const registro = (await this.resolveSlot(regExpr, env)).get();
        if (!(registro instanceof RecordVal)) {
          throw new RuntimeError(`${stmt.op} necesita el registro completo.`, stmt.pos);
        }
        if (stmt.op === "RE-ESCRIBIR") recurso.reescribir(registro, stmt.pos);
        else recurso.eliminar(registro, stmt.pos);
        this.existe = undefined;
        return;
      }
    }
  }

  private async execIo(stmt: Extract<Stmt, { kind: "io" }>, env: Env): Promise<void> {
    // si el primer argumento es un archivo o una secuencia, la E/S no es por pantalla
    if (stmt.args.length > 0 && stmt.args[0].kind === "ident") {
      const destino = env.lookup(stmt.args[0].name)?.value;
      if (destino instanceof ArchivoAbierto || destino instanceof SecuenciaAbierta) {
        await this.ioSobreRecurso(stmt, destino, env);
        return;
      }
    }

    if (stmt.op === "ESCRIBIR") {
      const parts: string[] = [];
      for (const arg of stmt.args) parts.push(formatValue(await this.eval(arg, env)));
      this.host.write(parts.join(""));
      return;
    }

    // LEER: una línea puede traer varios valores separados por espacios o comas,
    // salvo que el destino sea texto, donde la línea entera es el valor
    let pending: string[] = [];
    for (const arg of stmt.args) {
      const slot = await this.resolveSlot(arg, env);
      if (this.expectsText(slot.type)) {
        const raw = pending.length > 0 ? pending.splice(0).join(" ") : (await this.host.readLine()).trim();
        slot.set(this.parseInput(raw, slot.type, arg.pos, describe(arg)));
        continue;
      }
      while (pending.length === 0) {
        const line = (await this.host.readLine()).trim();
        pending = line.length === 0 ? [] : line.split(/[\s,]+/);
        if (pending.length === 0) {
          if (this.host.isCancelled?.()) throw new CancelledError();
          this.host.write("[aviso] falta el valor: escribilo y apretá Enter.");
        }
      }
      slot.set(this.parseInput(pending.shift() as string, slot.type, arg.pos, describe(arg)));
    }
  }

  private async ioSobreRecurso(
    stmt: Extract<Stmt, { kind: "io" }>,
    destino: ArchivoAbierto | SecuenciaAbierta,
    env: Env
  ): Promise<void> {
    const resto = stmt.args.slice(1);
    if (resto.length === 0) {
      throw new RuntimeError(
        `${stmt.op}(${destino.nombre}, ...) necesita también el registro o la variable.`,
        stmt.pos
      );
    }

    if (destino instanceof ArchivoAbierto) {
      const slot = await this.resolveSlot(resto[0], env);

      if (stmt.op === "LEER") {
        if (destino.esIndexado) {
          const buscado = slot.get();
          if (!(buscado instanceof RecordVal)) {
            throw new RuntimeError(
              `En un archivo indexado se busca con un registro que tenga la clave cargada: ` +
                `reg.${destino.indexadoPor[0] ?? "clave"} := ... y después LEER(${destino.nombre}, reg).`,
              stmt.pos
            );
          }
          const encontrado = destino.buscarPorClave(buscado, stmt.pos);
          this.existe = encontrado !== undefined;
          if (encontrado) slot.set(encontrado);
          return;
        }
        const registro = destino.leer(stmt.pos);
        if (registro) slot.set(registro);
        return;
      }

      const valor = slot.get();
      if (!(valor instanceof RecordVal)) {
        throw new RuntimeError(
          `En "${destino.nombre}" se graban registros completos: ESCRIBIR(${destino.nombre}, reg).`,
          stmt.pos
        );
      }
      if (destino.esIndexado) {
        destino.altaIndexada(valor, stmt.pos);
        this.existe = undefined;
        return;
      }
      destino.escribir(valor, stmt.pos);
      return;
    }

    if (stmt.op === "LEER") {
      throw new RuntimeError(
        `De una secuencia se avanza, no se lee: va AVZ(${destino.nombre}, v).`,
        stmt.pos
      );
    }
    for (const arg of resto) destino.escribir(await this.eval(arg, env), stmt.pos);
  }

  private expectsText(type: TypeNode | undefined): boolean {
    if (!type) return false;
    return type.kind === "text" || (type.kind === "scalar" && type.name === "alfanumerico");
  }

  private parseInput(raw: string, type: TypeNode | undefined, pos: Pos, destino: string): Value {
    const wantsNumber =
      type?.kind === "numeric" ||
      type?.kind === "subrange" ||
      (type?.kind === "scalar" && (type.name === "entero" || type.name === "real"));

    if (wantsNumber || !type) {
      const value = Number(raw.replace(",", "."));
      if (!Number.isNaN(value)) return this.coerce(value, type, pos, destino);
      if (wantsNumber) {
        throw new RuntimeError(
          `"${destino}" es ${nombreDelTipo(type)} y se escribió "${raw}", que no es un número.`,
          pos
        );
      }
      return raw;
    }

    if (type.kind === "scalar" && type.name === "logico") {
      const lower = raw.toLowerCase();
      if (["verdadero", "v", "si", "sí", "true", "1"].includes(lower)) return true;
      if (["falso", "f", "no", "false", "0"].includes(lower)) return false;
      throw new RuntimeError(
        `"${destino}" es logico: se escribe verdadero o falso, y se ingresó "${raw}".`,
        pos
      );
    }

    return this.coerce(raw, type, pos, destino);
  }

  // ── subacciones ──────────────────────────────────────────────────────────

  private async invoke(sub: SubprogramDecl, args: Expr[], callerEnv: Env, pos: Pos): Promise<Value | undefined> {
    if (args.length !== sub.params.length) {
      throw new RuntimeError(
        `"${sub.name}" espera ${sub.params.length} parámetro(s) y recibió ${args.length}.`,
        pos
      );
    }

    // el ámbito de una subacción es el suyo propio más el global: nunca el del que la llamó
    const local = new Env(this.globals);

    for (let i = 0; i < sub.params.length; i++) {
      const param = sub.params[i];
      const arg = args[i];
      if (param.byRef) {
        const slot = await this.resolveSlot(arg, callerEnv);
        local.define(param.name, new Cell(slot.get(), param.type, slot));
      } else {
        const value = cloneValue(await this.eval(arg, callerEnv));
        local.define(
          param.name,
          new Cell(this.coerce(value, param.type, arg.pos, param.name), param.type)
        );
      }
    }

    this.declare(sub.locals, local);

    let resultCell: Cell | undefined;
    if (sub.isFunction) {
      resultCell = new Cell(sub.returnType ? this.defaultValue(sub.returnType) : 0, sub.returnType);
      local.define(sub.name, resultCell);
    }

    await this.execBlock(sub.body, local);
    return resultCell?.value;
  }

  // ── expresiones ──────────────────────────────────────────────────────────

  private async resolveSlot(expr: Expr, env: Env): Promise<Slot> {
    switch (expr.kind) {
      case "ident": {
        const cell = env.lookup(expr.name);
        if (!cell) throw new RuntimeError(`"${expr.name}" no está declarada en el Ambiente.`, expr.pos);
        return {
          get: () => cell.value,
          set: (value) => {
            cell.value = value;
          },
          type: cell.type,
        };
      }
      case "field": {
        const target = await this.resolveSlot(expr.target, env);
        const record = target.get();
        if (!(record instanceof RecordVal)) {
          throw new RuntimeError(`"${describe(expr.target)}" no es un registro: no tiene campos.`, expr.pos);
        }
        const key = expr.field.toLowerCase();
        if (!record.fields.has(key)) {
          throw new RuntimeError(
            `El registro "${record.typeName}" no tiene un campo "${expr.field}".`,
            expr.pos
          );
        }
        const decl = this.types.get(record.typeName.toLowerCase());
        return {
          get: () => record.fields.get(key) as Value,
          set: (value) => record.fields.set(key, value),
          type: decl ? this.fieldType(decl, expr.field) : undefined,
        };
      }
      case "index": {
        const target = await this.resolveSlot(expr.target, env);
        const array = target.get();
        if (!(array instanceof ArrayVal)) {
          throw new RuntimeError(`"${describe(expr.target)}" no es un arreglo.`, expr.pos);
        }
        const indices: number[] = [];
        for (const idx of expr.indices) {
          indices.push(numeric(await this.eval(idx, env), idx.pos));
        }
        const offset = array.offset(indices, expr.pos);
        const elementType = target.type?.kind === "array" ? target.type.element : undefined;
        return {
          get: () => array.data[offset],
          set: (value) => {
            array.data[offset] = value;
          },
          type: elementType,
        };
      }
      default:
        throw new RuntimeError("Acá va una variable, un campo o una componente de arreglo.", expr.pos);
    }
  }

  private async eval(expr: Expr, env: Env): Promise<Value> {
    this.tick(expr.pos);
    switch (expr.kind) {
      case "number":
        return expr.value;
      case "string":
        return expr.value;
      case "bool":
        return expr.value;
      case "existe":
        if (this.existe === undefined) {
          throw new RuntimeError(
            "SI EXISTE pregunta por el resultado del último LEER sobre un archivo indexado, y todavía no se leyó ninguno. " +
              "Primero va la clave, después el LEER, y recién ahí el SI EXISTE.",
            expr.pos
          );
        }
        return this.existe;
      case "ident": {
        const cell = env.lookup(expr.name);
        if (!cell) {
          const sub = this.subprograms.get(expr.name.toLowerCase());
          if (sub) {
            throw new RuntimeError(
              sub.isFunction
                ? `"${expr.name}" es una FUNCION: se invoca con sus parámetros, ${expr.name}(...).`
                : `"${expr.name}" es un PROCEDIMIENTO: no devuelve ningún valor, no se puede usar dentro de una expresión.`,
              expr.pos
            );
          }
          throw new RuntimeError(`"${expr.name}" no está declarada en el Ambiente.`, expr.pos);
        }
        return cell.value;
      }
      case "field":
      case "index":
        return (await this.resolveSlot(expr, env)).get();
      case "callExpr": {
        const key = expr.callee.toLowerCase();
        if (["fda", "nfda", "fds", "nfds"].includes(key)) {
          if (expr.args.length !== 1) {
            throw new RuntimeError(`${expr.callee.toUpperCase()} va con el archivo o la secuencia entre paréntesis.`, expr.pos);
          }
          const recurso = await this.recurso(expr.args[0], env, expr.pos);
          if (recurso instanceof ArchivoAbierto && recurso.esIndexado) {
            throw new RuntimeError(
              `"${recurso.nombre}" es un archivo INDEXADO: no se recorre con ${expr.callee.toUpperCase()}, ` +
                "se accede por clave. El recorrido de principio a fin es de los archivos secuenciales " +
                "(errores-y-trampas, trampas conceptuales).",
              expr.pos
            );
          }
          const fin =
            recurso instanceof ArchivoAbierto
              ? recurso.fda
              : (recurso as SecuenciaAbierta).fds;
          return key.startsWith("n") ? !fin : fin;
        }
        if (key === "abso") {
          if (expr.args.length !== 1) throw new RuntimeError("ABSO recibe un solo argumento.", expr.pos);
          return Math.abs(numeric(await this.eval(expr.args[0], env), expr.pos));
        }
        const sub = this.subprograms.get(key);
        if (!sub) throw new RuntimeError(`La función "${expr.callee}" no está declarada.`, expr.pos);
        if (!sub.isFunction) {
          throw new RuntimeError(
            `"${expr.callee}" es un PROCEDIMIENTO: no devuelve ningún valor, no se puede usar dentro de una expresión.`,
            expr.pos
          );
        }
        return (await this.invoke(sub, expr.args, env, expr.pos)) as Value;
      }
      case "unary": {
        const value = await this.eval(expr.operand, env);
        if (expr.op === "-") return -numeric(value, expr.pos);
        return !truthy(value, expr.pos);
      }
      case "binary": {
        if (expr.op === "Y") {
          const left = truthy(await this.eval(expr.left, env), expr.left.pos);
          if (!left) return false;
          return truthy(await this.eval(expr.right, env), expr.right.pos);
        }
        if (expr.op === "O") {
          const left = truthy(await this.eval(expr.left, env), expr.left.pos);
          if (left) return true;
          return truthy(await this.eval(expr.right, env), expr.right.pos);
        }
        const left = await this.eval(expr.left, env);
        const right = await this.eval(expr.right, env);
        return applyBinary(expr.op, left, right, expr.pos, this.types);
      }
    }
  }

  // ── tipos en tiempo de ejecución ─────────────────────────────────────────

  private coerce(value: Value, type: TypeNode | undefined, pos: Pos, destino?: string): Value {
    if (!type) return value;
    switch (type.kind) {
      case "scalar":
        switch (type.name) {
          case "entero":
            if (typeof value !== "number") throw this.typeError(value, "entero", pos);
            if (!Number.isInteger(value)) {
              throw new RuntimeError(
                `${destino ? `"${destino}" es entera y se le intentó guardar ${value}` : `Se intentó guardar ${value} en una variable entera`}. ` +
                  "Para que la división dé un entero va DIV (y MOD para el resto): 7 DIV 2 es 3.",
                pos
              );
            }
            return value;
          case "real":
            if (typeof value !== "number") throw this.typeError(value, "real", pos);
            return value;
          case "logico":
            if (typeof value !== "boolean") throw this.typeError(value, "logico", pos);
            return value;
          case "caracter": {
            if (typeof value !== "string") throw this.typeError(value, "caracter", pos);
            if (value.length > 1) {
              this.host.write(`[aviso] se guardó solo el primer carácter de "${value}" en una variable caracter.`);
              return value.charAt(0);
            }
            return value;
          }
          case "alfanumerico":
            if (typeof value !== "string") throw this.typeError(value, "alfanumerico", pos);
            return value;
        }
        return value;
      case "text": {
        if (typeof value !== "string") throw this.typeError(value, `AN(${type.length})`, pos);
        if (value.length > type.length) {
          this.host.write(`[aviso] el texto se recortó a ${type.length} caracteres (AN(${type.length})).`);
          return value.slice(0, type.length);
        }
        return value;
      }
      case "numeric": {
        if (typeof value !== "number") throw this.typeError(value, `N(${type.digits})`, pos);
        if (type.decimals === 0 && !Number.isInteger(value)) {
          throw new RuntimeError(`N(${type.digits}) guarda enteros: ${value} tiene decimales.`, pos);
        }
        return value;
      }
      case "subrange": {
        if (typeof value !== "number") throw this.typeError(value, `${type.low}..${type.high}`, pos);
        if (value < type.low || value > type.high) {
          throw new RuntimeError(
            `${destino ? `"${destino}" está declarada ${type.low}..${type.high}` : `El subrango es ${type.low}..${type.high}`} y se le intentó guardar ${value}.`,
            pos
          );
        }
        return value;
      }
      case "enum": {
        if (typeof value !== "string") throw this.typeError(value, type.values.join(", "), pos);
        const match = type.values.find((v) => v.toLowerCase() === value.toLowerCase());
        if (!match) {
          throw new RuntimeError(
            `${destino ? `"${destino}" solo acepta` : "Los valores declarados son"} ${type.values.map((v) => `"${v}"`).join(", ")}, y se le intentó guardar "${value}".`,
            pos
          );
        }
        return match;
      }
      case "named": {
        if (!(value instanceof RecordVal)) throw this.typeError(value, type.name, pos);
        if (value.typeName.toLowerCase() !== type.name.toLowerCase()) {
          throw new RuntimeError(
            `No se puede asignar un registro "${value.typeName}" a uno "${type.name}": entre tipos distintos se asigna campo por campo (sintaxis-completa §3).`,
            pos
          );
        }
        return value.clone();
      }
      case "array": {
        if (!(value instanceof ArrayVal)) throw this.typeError(value, "arreglo", pos);
        return value.clone();
      }
      default:
        return value;
    }
  }

  private typeError(value: Value, expected: string, pos: Pos): RuntimeError {
    return new RuntimeError(`Se esperaba un valor de tipo ${expected} y se obtuvo "${formatValue(value)}".`, pos);
  }
}

// ── operaciones ────────────────────────────────────────────────────────────

function applyBinary(
  op: string,
  left: Value,
  right: Value,
  pos: Pos,
  types: Map<string, RecordDecl>
): Value {
  switch (op) {
    case "+": {
      if (typeof left === "string" || typeof right === "string") {
        return `${formatValue(left)}${formatValue(right)}`;
      }
      return numeric(left, pos) + numeric(right, pos);
    }
    case "-":
      return numeric(left, pos) - numeric(right, pos);
    case "*":
      return numeric(left, pos) * numeric(right, pos);
    case "/": {
      const divisor = numeric(right, pos);
      if (divisor === 0) throw new RuntimeError("División por cero (errores-y-trampas #19).", pos);
      return numeric(left, pos) / divisor;
    }
    case "DIV": {
      const divisor = numeric(right, pos);
      if (divisor === 0) throw new RuntimeError("División entera por cero (errores-y-trampas #19).", pos);
      return Math.trunc(numeric(left, pos) / divisor);
    }
    case "MOD": {
      const divisor = numeric(right, pos);
      if (divisor === 0) throw new RuntimeError("MOD por cero (errores-y-trampas #19).", pos);
      return numeric(left, pos) % divisor;
    }
    case "**":
      return numeric(left, pos) ** numeric(right, pos);
    case "=":
      return looseEquals(left, right, types);
    case "<>":
      return !looseEquals(left, right, types);
    case ">":
      return compare(left, right, pos, types) > 0;
    case ">=":
      return compare(left, right, pos, types) >= 0;
    case "<":
      return compare(left, right, pos, types) < 0;
    case "<=":
      return compare(left, right, pos, types) <= 0;
    case "EN": {
      if (typeof right === "string") return right.includes(String(left));
      if (right instanceof ArrayVal) return right.data.some((v) => looseEquals(v, left, types));
      throw new RuntimeError("A la derecha de EN va un conjunto: un texto o un arreglo.", pos);
    }
    default:
      throw new RuntimeError(`Operador no soportado: ${op}.`, pos);
  }
}

/**
 * Los registros se comparan campo por campo en el orden en que fueron declarados:
 * por eso una FECHA se declara anio, mes, dia (sintaxis-completa §3).
 */
function compare(left: Value, right: Value, pos: Pos, types: Map<string, RecordDecl>): number {
  if (left instanceof RecordVal && right instanceof RecordVal) {
    const decl = types.get(left.typeName.toLowerCase());
    const keys = decl
      ? decl.fields.map((f) => f.name.toLowerCase())
      : [...left.fields.keys()];
    for (const key of keys) {
      const a = left.fields.get(key);
      const b = right.fields.get(key);
      if (a === undefined || b === undefined) continue;
      const result = compare(a, b, pos, types);
      if (result !== 0) return result;
    }
    return 0;
  }
  if (typeof left === "string" || typeof right === "string") {
    const a = String(formatValue(left));
    const b = String(formatValue(right));
    return a < b ? -1 : a > b ? 1 : 0;
  }
  if (typeof left === "boolean" || typeof right === "boolean") {
    const a = left ? 1 : 0;
    const b = right ? 1 : 0;
    return a - b;
  }
  const a = numeric(left, pos);
  const b = numeric(right, pos);
  return a - b;
}

function looseEquals(left: Value, right: Value, types: Map<string, RecordDecl>): boolean {
  if (left instanceof RecordVal && right instanceof RecordVal) {
    return compare(left, right, { line: 0, col: 0, offset: 0, length: 0 }, types) === 0;
  }
  if (typeof left === "string" && typeof right === "string") return left === right;
  if (typeof left === "boolean" || typeof right === "boolean") return left === right;
  if (typeof left === "number" && typeof right === "number") return left === right;
  return formatValue(left) === formatValue(right);
}

function numeric(value: Value, pos: Pos): number {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) return Number(value);
  throw new RuntimeError(`Se esperaba un número y se obtuvo "${formatValue(value)}".`, pos);
}

function truthy(value: Value, pos: Pos): boolean {
  if (typeof value === "boolean") return value;
  throw new RuntimeError(
    `Se esperaba una condición verdadero/falso y se obtuvo "${formatValue(value)}".`,
    pos
  );
}



function nombreDelTipo(type: TypeNode | undefined): string {
  if (!type) return "un valor";
  switch (type.kind) {
    case "scalar":
      return `de tipo ${type.name}`;
    case "text":
      return `de tipo AN(${type.length})`;
    case "numeric":
      return type.decimals > 0 ? `de tipo N(${type.digits},${type.decimals})` : `de tipo N(${type.digits})`;
    case "subrange":
      return `un subrango ${type.low}..${type.high}`;
    case "enum":
      return `uno de estos valores: ${type.values.map((v) => `"${v}"`).join(", ")}`;
    default:
      return "un valor";
  }
}

function describe(expr: Expr): string {
  if (expr.kind === "ident") return expr.name;
  if (expr.kind === "field") return `${describe(expr.target)}.${expr.field}`;
  if (expr.kind === "index") {
    const indices = expr.indices
      .map((idx) =>
        idx.kind === "number" ? String(idx.value) : idx.kind === "ident" ? idx.name : "..."
      )
      .join(", ");
    return `${describe(expr.target)}[${indices}]`;
  }
  return "la expresión";
}
