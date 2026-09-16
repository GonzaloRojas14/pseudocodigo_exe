export interface Pos {
  line: number;
  col: number;
  offset: number;
  length: number;
}

export interface Node {
  pos: Pos;
}

// ── Tipos ──────────────────────────────────────────────────────────────────

export type TypeNode =
  | ScalarType
  | TextType
  | NumericType
  | SubrangeType
  | EnumType
  | ArrayType
  | ArchivoType
  | SecuenciaType
  | NamedType;

export interface ScalarType extends Node {
  kind: "scalar";
  name: "entero" | "real" | "caracter" | "logico" | "alfanumerico";
}

/** AN(50) */
export interface TextType extends Node {
  kind: "text";
  length: number;
}

/** N(8) o N(5,2) */
export interface NumericType extends Node {
  kind: "numeric";
  digits: number;
  decimals: number;
}

export interface SubrangeType extends Node {
  kind: "subrange";
  low: number;
  high: number;
}

export interface EnumType extends Node {
  kind: "enum";
  values: string[];
}

export interface ArrayType extends Node {
  kind: "array";
  dims: { low: number; high: number }[];
  element: TypeNode;
}

export interface ArchivoType extends Node {
  kind: "archivo";
  element: TypeNode;
  /** claves de "ordenado por ..." */
  orderedBy: string[];
  /** clave de "INDEXADO por ..." */
  indexedBy: string[];
}

export interface SecuenciaType extends Node {
  kind: "secuencia";
  element: TypeNode;
}

/** referencia a un tipo REGISTRO declarado antes */
export interface NamedType extends Node {
  kind: "named";
  name: string;
}

// ── Declaraciones ──────────────────────────────────────────────────────────

export type Declaration = ConstDecl | RecordDecl | VarDecl | SubprogramDecl;

export interface ConstDecl extends Node {
  kind: "const";
  name: string;
  value: Expr;
}

export interface RecordDecl extends Node {
  kind: "record";
  name: string;
  fields: FieldDecl[];
}

export interface FieldDecl extends Node {
  name: string;
  type: TypeNode;
}

export interface VarDecl extends Node {
  kind: "var";
  names: string[];
  type: TypeNode;
}

export interface Param extends Node {
  name: string;
  byRef: boolean;
  type: TypeNode;
}

export interface SubprogramDecl extends Node {
  kind: "subprogram";
  isFunction: boolean;
  name: string;
  params: Param[];
  returnType?: TypeNode;
  locals: Declaration[];
  body: Stmt[];
}

// ── Sentencias ─────────────────────────────────────────────────────────────

export type Stmt =
  | AssignStmt
  | IfStmt
  | SegunStmt
  | WhileStmt
  | RepeatStmt
  | ForStmt
  | IoStmt
  | CallStmt
  | FileStmt;

export interface AssignStmt extends Node {
  kind: "assign";
  target: LValue;
  value: Expr;
}

export interface IfStmt extends Node {
  kind: "if";
  cond: Expr;
  then: Stmt[];
  else?: Stmt[];
}

export interface SegunBranch extends Node {
  /** vacío = rama "otros" / "CONTRARIO" */
  labels: Expr[];
  body: Stmt[];
}

export interface SegunStmt extends Node {
  kind: "segun";
  subject: Expr;
  branches: SegunBranch[];
}

export interface WhileStmt extends Node {
  kind: "while";
  cond: Expr;
  body: Stmt[];
}

export interface RepeatStmt extends Node {
  kind: "repeat";
  body: Stmt[];
  cond: Expr;
}

export interface ForStmt extends Node {
  kind: "for";
  counter: string;
  from: Expr;
  to: Expr;
  step?: Expr;
  body: Stmt[];
}

/** ESCRIBIR(...) y LEER(...): consola o archivo/secuencia según el 1er argumento */
export interface IoStmt extends Node {
  kind: "io";
  op: "ESCRIBIR" | "LEER";
  args: Expr[];
}

export interface CallStmt extends Node {
  kind: "call";
  name: string;
  args: Expr[];
  /** el procedimiento se invocó con paréntesis */
  hadParens: boolean;
}

/** ABRIR / CERRAR / ARR / AVZ / CREAR / RE-ESCRIBIR / ELIMINAR */
export interface FileStmt extends Node {
  kind: "file";
  op: "ABRIR" | "CERRAR" | "ARR" | "AVZ" | "CREAR" | "RE-ESCRIBIR" | "ELIMINAR";
  /** modo de ABRIR: "E" (lectura), "S" (escritura), "ES" (lectura/escritura) */
  mode?: "E" | "S" | "ES";
  args: Expr[];
}

// ── Expresiones ────────────────────────────────────────────────────────────

export type Expr =
  | NumberLit
  | StringLit
  | BoolLit
  | Ident
  | FieldAccess
  | IndexAccess
  | CallExpr
  | UnaryExpr
  | BinaryExpr
  | ExisteExpr;

/** lo que puede ir a la izquierda de := o dentro de un LEER */
export type LValue = Ident | FieldAccess | IndexAccess;

export interface NumberLit extends Node {
  kind: "number";
  value: number;
  isReal: boolean;
}

export interface StringLit extends Node {
  kind: "string";
  value: string;
}

export interface BoolLit extends Node {
  kind: "bool";
  value: boolean;
}

export interface Ident extends Node {
  kind: "ident";
  name: string;
}

export interface FieldAccess extends Node {
  kind: "field";
  target: Expr;
  field: string;
}

export interface IndexAccess extends Node {
  kind: "index";
  target: Expr;
  indices: Expr[];
}

export interface CallExpr extends Node {
  kind: "callExpr";
  callee: string;
  args: Expr[];
}

export interface UnaryExpr extends Node {
  kind: "unary";
  op: "-" | "NO";
  operand: Expr;
}

export interface BinaryExpr extends Node {
  kind: "binary";
  op: string;
  left: Expr;
  right: Expr;
}

/** SI EXISTE ENTONCES — resultado del último LEER sobre un indexado */
export interface ExisteExpr extends Node {
  kind: "existe";
}

// ── Programa ───────────────────────────────────────────────────────────────

export interface Program extends Node {
  name: string;
  namePos: Pos;
  declarations: Declaration[];
  body: Stmt[];
  /** notación detectada: "moderna" (Proceso/SINO/FIN_SI) y/o "vieja" (Algoritmo/Contrario/FinSi) */
  notations: Set<string>;
}
