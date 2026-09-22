import type { Pos, RecordDecl, TypeNode } from "./ast";
import { RecordVal, RuntimeError, formatValue, type Archivo, type Secuencia, type Value } from "./valores";

/**
 * De dónde salen y a dónde van los datos. La extensión lo resuelve contra la
 * carpeta "<ejercicio>.datos/" que está al lado del .frre; los tests lo hacen
 * en memoria.
 */
export interface SistemaDeArchivos {
  leer(nombre: string, extension: string): string | undefined;
  escribir(nombre: string, extension: string, contenido: string): void;
  ruta(nombre: string, extension: string): string;
}

/** una columna del TSV: una hoja del registro, con su camino de campos */
export interface Columna {
  ruta: string[];
  titulo: string;
  tipo: TypeNode;
}

export function columnasDe(
  tipo: TypeNode,
  tipos: Map<string, RecordDecl>,
  prefijo: string[] = [],
  pos?: Pos
): Columna[] {
  if (tipo.kind === "named") {
    const registro = tipos.get(tipo.name.toLowerCase());
    if (!registro) throw new RuntimeError(`El tipo "${tipo.name}" no está declarado.`, pos ?? tipo.pos);
    return registro.fields.flatMap((campo) =>
      columnasDe(campo.type, tipos, [...prefijo, campo.name], pos)
    );
  }
  if (tipo.kind === "array" || tipo.kind === "archivo" || tipo.kind === "secuencia") {
    throw new RuntimeError(
      `El campo "${prefijo.join(".")}" es ${tipo.kind === "array" ? "un arreglo" : "un archivo"}, ` +
        "y eso no se puede guardar como columna de una tabla.",
      pos ?? tipo.pos
    );
  }
  return [{ ruta: prefijo, titulo: prefijo.join("."), tipo }];
}

/** texto de una celda → valor del tipo declarado, con un error que dice dónde falló */
function celdaAValor(texto: string, columna: Columna, donde: string, pos?: Pos): Value {
  const limpio = texto.trim();
  const tipo = columna.tipo;
  const fallar = (esperado: string): never => {
    throw new RuntimeError(
      `${donde}, columna "${columna.titulo}": se esperaba ${esperado} y dice "${texto}".`,
      pos
    );
  };

  switch (tipo.kind) {
    case "scalar":
      switch (tipo.name) {
        case "entero": {
          if (limpio === "") return 0;
          const valor = Number(limpio.replace(",", "."));
          if (!Number.isInteger(valor)) fallar("un número entero");
          return valor;
        }
        case "real": {
          if (limpio === "") return 0;
          const valor = Number(limpio.replace(",", "."));
          if (Number.isNaN(valor)) fallar("un número");
          return valor;
        }
        case "logico": {
          const bajo = limpio.toLowerCase();
          if (["verdadero", "v", "si", "sí", "true", "1"].includes(bajo)) return true;
          if (["falso", "f", "no", "false", "0", ""].includes(bajo)) return false;
          return fallar("verdadero o falso");
        }
        case "caracter":
          return limpio.charAt(0);
        default:
          return texto;
      }
    case "text":
      if (texto.length > tipo.length) return texto.slice(0, tipo.length);
      return texto;
    case "numeric": {
      if (limpio === "") return 0;
      const valor = Number(limpio.replace(",", "."));
      if (Number.isNaN(valor)) fallar("un número");
      if (tipo.decimals === 0 && !Number.isInteger(valor)) fallar(`un entero de ${tipo.digits} dígitos`);
      return valor;
    }
    case "subrange": {
      if (limpio === "") return tipo.low;
      const valor = Number(limpio);
      if (!Number.isInteger(valor)) fallar(`un entero entre ${tipo.low} y ${tipo.high}`);
      if (valor < tipo.low || valor > tipo.high) fallar(`un valor entre ${tipo.low} y ${tipo.high}`);
      return valor;
    }
    case "enum": {
      if (limpio === "") return tipo.values[0] ?? "";
      const match = tipo.values.find((v) => v.toLowerCase() === limpio.toLowerCase());
      if (!match) fallar(`uno de estos valores: ${tipo.values.map((v) => `"${v}"`).join(", ")}`);
      return match as string;
    }
    default:
      return texto;
  }
}

function ponerEnRuta(destino: RecordVal, ruta: string[], valor: Value): void {
  let actual = destino;
  for (let i = 0; i < ruta.length - 1; i++) {
    const siguiente = actual.fields.get(ruta[i].toLowerCase());
    if (!(siguiente instanceof RecordVal)) return;
    actual = siguiente;
  }
  actual.fields.set(ruta[ruta.length - 1].toLowerCase(), valor);
}

function leerDeRuta(origen: RecordVal, ruta: string[]): Value {
  let actual: Value = origen;
  for (const paso of ruta) {
    if (!(actual instanceof RecordVal)) return "";
    actual = actual.fields.get(paso.toLowerCase()) ?? "";
  }
  return actual;
}

/**
 * Un ARCHIVO abierto. Se carga entero en memoria al abrir: los archivos de los
 * ejercicios son chicos y así ESCRIBIR, RE-ESCRIBIR y ELIMINAR son directos.
 */
export class ArchivoAbierto implements Archivo {
  readonly clase = "archivo" as const;
  abierto = false;
  /** verdadero cuando el último LEER no trajo ningún registro */
  fda = false;
  filas: RecordVal[] = [];
  indice = 0;
  modo: "E" | "S" | "ES" = "E";
  /** el último LEER dejó el cursor acá: lo necesita RE-ESCRIBIR */
  ultimaLeida = -1;
  modificado = false;

  /** campos que forman la clave, si el archivo es INDEXADO */
  indexadoPor: string[] = [];
  /** claves declaradas en "ordenado por ...": son la precondición del corte de control */
  ordenadoPor: string[] = [];

  constructor(
    readonly nombre: string,
    readonly registro: RecordDecl | undefined,
    private columnas: Columna[],
    private plantillaVacia: () => RecordVal
  ) {}

  get esIndexado(): boolean {
    return this.indexadoPor.length > 0;
  }

  /** la clave de un registro, como texto, para poder buscarla */
  private claveDe(registro: RecordVal, pos?: Pos): string {
    return this.indexadoPor
      .map((campo) => {
        const valor = registro.fields.get(campo.toLowerCase());
        if (valor === undefined) {
          throw new RuntimeError(
            `El registro no tiene el campo "${campo}", que es la clave por la que está indexado "${this.nombre}".`,
            pos
          );
        }
        return formatValue(valor);
      })
      .join("\u0001");
  }

  private posicionDe(registro: RecordVal, pos?: Pos): number {
    const clave = this.claveDe(registro, pos);
    return this.filas.findIndex((fila) => this.claveDe(fila, pos) === clave);
  }

  /** busca por clave: deja el registro completo si existe */
  buscarPorClave(registro: RecordVal, pos?: Pos): RecordVal | undefined {
    this.exigirAbierto(pos);
    const indice = this.posicionDe(registro, pos);
    this.ultimaLeida = indice;
    if (indice < 0) return undefined;
    return this.filas[indice].clone();
  }

  altaIndexada(registro: RecordVal, pos?: Pos): void {
    this.exigirAbierto(pos);
    if (this.posicionDe(registro, pos) >= 0) {
      throw new RuntimeError(
        `Ya hay un registro con esa clave en "${this.nombre}": un alta pide que la clave NO exista. ` +
          "Antes del ESCRIBIR va el LEER y el SI EXISTE.",
        pos
      );
    }
    this.filas.push(registro.clone());
    this.marcarModificado();
  }

  reescribir(registro: RecordVal, pos?: Pos): void {
    this.exigirAbierto(pos);
    if (this.ultimaLeida < 0) {
      throw new RuntimeError(
        `RE-ESCRIBIR sin un LEER que haya encontrado el registro: no hay posición sobre la cual sobreescribir. ` +
          `Va clave → LEER(${this.nombre}, reg) → SI EXISTE → RE-ESCRIBIR.`,
        pos
      );
    }
    this.filas[this.ultimaLeida] = registro.clone();
    this.marcarModificado();
  }

  eliminar(registro: RecordVal, pos?: Pos): void {
    this.exigirAbierto(pos);
    const indice = this.posicionDe(registro, pos);
    if (indice < 0) {
      throw new RuntimeError(
        `No hay ningún registro con esa clave en "${this.nombre}" para eliminar.`,
        pos
      );
    }
    this.filas.splice(indice, 1);
    this.ultimaLeida = -1;
    this.marcarModificado();
  }

  private marcarModificado(): void {
    this.modificado = true;
  }

  abrir(modo: "E" | "S" | "ES", fs: SistemaDeArchivos, pos?: Pos): void {
    if (!this.registro) {
      throw new RuntimeError(
        `"${this.nombre}" tiene que ser un ARCHIVO de un REGISTRO: es lo que define las columnas de sus datos.`,
        pos
      );
    }
    this.modo = modo;
    this.abierto = true;
    this.indice = 0;
    this.fda = false;
    this.ultimaLeida = -1;
    this.modificado = modo === "S";

    if (modo === "S") {
      this.filas = [];
      return;
    }

    const contenido = fs.leer(this.nombre, ".tsv");
    if (contenido === undefined && this.esIndexado && modo === "ES") {
      // un ABM puede arrancar con el maestro vacío: se crea al cerrar
      this.filas = [];
      this.modificado = true;
      return;
    }
    if (contenido === undefined) {
      throw new RuntimeError(
        `No encontré los datos de "${this.nombre}". Tendría que estar en ${fs.ruta(this.nombre, ".tsv")}. ` +
          'Usá el comando "AED: Generar plantilla de datos" y cargá las filas ahí.',
        pos
      );
    }
    this.filas = this.parsearTsv(contenido, fs.ruta(this.nombre, ".tsv"), pos);
    this.verificarOrden(pos);
  }

  /**
   * El corte de control solo funciona si el archivo viene ordenado por las claves
   * de corte. Si la declaración lo promete y el archivo no cumple, más vale decirlo
   * acá que dejar que salgan totales partidos.
   */
  private verificarOrden(pos?: Pos): void {
    if (this.ordenadoPor.length === 0) return;

    for (let i = 1; i < this.filas.length; i++) {
      const comparacion = this.compararPorClaves(this.filas[i - 1], this.filas[i]);
      if (comparacion <= 0) continue;

      const valores = this.ordenadoPor
        .map((campo) => formatValue(this.filas[i].fields.get(campo.toLowerCase()) ?? ""))
        .join(", ");
      const anteriores = this.ordenadoPor
        .map((campo) => formatValue(this.filas[i - 1].fields.get(campo.toLowerCase()) ?? ""))
        .join(", ");
      throw new RuntimeError(
        `"${this.nombre}" está declarado "ordenado por ${this.ordenadoPor.join(", ")}", pero los datos no lo están: ` +
          `la fila ${i + 2} (${valores}) va antes que la ${i + 1} (${anteriores}). ` +
          "Ordená el archivo por esas claves, de mayor a menor jerarquía: si no, el corte de control " +
          "vuelve a abrir grupos ya cerrados y los totales salen partidos.",
        pos
      );
    }
  }

  private compararPorClaves(a: RecordVal, b: RecordVal): number {
    for (const campo of this.ordenadoPor) {
      const clave = campo.toLowerCase();
      const va = a.fields.get(clave);
      const vb = b.fields.get(clave);
      if (va === undefined || vb === undefined) continue;
      if (typeof va === "number" && typeof vb === "number") {
        if (va !== vb) return va < vb ? -1 : 1;
        continue;
      }
      const sa = formatValue(va);
      const sb = formatValue(vb);
      if (sa !== sb) return sa < sb ? -1 : 1;
    }
    return 0;
  }

  private parsearTsv(contenido: string, ruta: string, pos?: Pos): RecordVal[] {
    const lineas = contenido.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lineas.length === 0) return [];

    const encabezado = lineas[0].split("\t").map((c) => c.trim());
    const pareceEncabezado = encabezado.some((c) =>
      this.columnas.some((col) => col.titulo.toLowerCase() === c.toLowerCase())
    );
    const columnasDelArchivo = pareceEncabezado
      ? encabezado.map((titulo) =>
          this.columnas.find((col) => col.titulo.toLowerCase() === titulo.toLowerCase())
        )
      : this.columnas;
    const filasDeDatos = pareceEncabezado ? lineas.slice(1) : lineas;

    return filasDeDatos.map((linea, i) => {
      const celdas = linea.split("\t");
      const registro = this.plantillaVacia();
      columnasDelArchivo.forEach((columna, c) => {
        if (!columna) return;
        const donde = `${ruta.split("/").pop()}, fila ${i + (pareceEncabezado ? 2 : 1)}`;
        ponerEnRuta(registro, columna.ruta, celdaAValor(celdas[c] ?? "", columna, donde, pos));
      });
      return registro;
    });
  }

  leer(pos?: Pos): RecordVal | undefined {
    this.exigirAbierto(pos);
    if (this.esIndexado) {
      throw new RuntimeError(
        `"${this.nombre}" es un archivo INDEXADO: no se recorre de principio a fin, se accede por clave. ` +
          `Asigná la clave en el registro y después LEER(${this.nombre}, reg).`,
        pos
      );
    }
    if (this.modo === "S") {
      throw new RuntimeError(
        `"${this.nombre}" se abrió solo para escritura (ABRIR /S): no se puede leer de él.`,
        pos
      );
    }
    if (this.indice >= this.filas.length) {
      this.fda = true;
      this.ultimaLeida = -1;
      return undefined;
    }
    this.fda = false;
    this.ultimaLeida = this.indice;
    return this.filas[this.indice++].clone();
  }

  escribir(registro: RecordVal, pos?: Pos): void {
    this.exigirAbierto(pos);
    if (this.modo === "E") {
      throw new RuntimeError(
        `"${this.nombre}" se abrió solo para lectura (ABRIR E/): no se puede escribir en él.`,
        pos
      );
    }
    this.filas.push(registro.clone());
    this.modificado = true;
  }

  cerrar(fs: SistemaDeArchivos): void {
    if (this.abierto && this.modo !== "E" && this.modificado) {
      fs.escribir(this.nombre, ".tsv", this.serializar());
    }
    this.abierto = false;
  }

  serializar(): string {
    const lineas = [this.columnas.map((c) => c.titulo).join("\t")];
    for (const fila of this.filas) {
      lineas.push(this.columnas.map((c) => formatValue(leerDeRuta(fila, c.ruta))).join("\t"));
    }
    return lineas.join("\n") + "\n";
  }

  /** para la plantilla de datos: solo el encabezado */
  encabezado(): string {
    return this.columnas.map((c) => c.titulo).join("\t") + "\n";
  }

  private exigirAbierto(pos?: Pos): void {
    if (!this.abierto) {
      throw new RuntimeError(
        `"${this.nombre}" no está abierto. Antes de usarlo va ABRIR E/(${this.nombre}) para leer, ` +
          `o ABRIR /S(${this.nombre}) para escribir.`,
        pos
      );
    }
  }
}

/** Una SECUENCIA: una tira de elementos que se recorre de a uno con AVZ. */
export class SecuenciaAbierta implements Secuencia {
  readonly clase = "secuencia" as const;
  abierta = false;
  /** verdadero cuando el último AVZ no trajo ningún elemento */
  fds = false;
  elementos: Value[] = [];
  indice = 0;
  modo: "lectura" | "escritura" = "lectura";
  private salida: Value[] = [];

  constructor(
    readonly nombre: string,
    private esDeCaracteres: boolean
  ) {}

  arrancar(fs: SistemaDeArchivos, pos?: Pos): void {
    const contenido = fs.leer(this.nombre, ".txt");
    if (contenido === undefined) {
      throw new RuntimeError(
        `No encontré los datos de la secuencia "${this.nombre}". Tendría que estar en ${fs.ruta(this.nombre, ".txt")}. ` +
          'Usá el comando "AED: Generar plantilla de datos" y escribí la cinta ahí.',
        pos
      );
    }
    // la cinta es una sola tira: los saltos de línea del archivo cuentan como un blanco
    const plano = contenido.replace(/\r/g, "").replace(/\n+$/, "").replace(/\n/g, " ");
    this.elementos = this.esDeCaracteres
      ? [...plano]
      : plano
          .split(/[\s,]+/)
          .filter((t) => t !== "")
          .map((t) => Number(t));
    this.indice = 0;
    this.fds = false;
    this.abierta = true;
    this.modo = "lectura";
  }

  crear(pos?: Pos): void {
    this.salida = [];
    this.abierta = true;
    this.modo = "escritura";
    this.fds = false;
    void pos;
  }

  avanzar(pos?: Pos): Value | undefined {
    if (!this.abierta) {
      throw new RuntimeError(
        `La secuencia "${this.nombre}" no está arrancada: antes de avanzar va ARR(${this.nombre}).`,
        pos
      );
    }
    if (this.modo === "escritura") {
      throw new RuntimeError(`"${this.nombre}" se creó para escribir: no se puede avanzar sobre ella.`, pos);
    }
    if (this.indice >= this.elementos.length) {
      this.fds = true;
      return undefined;
    }
    this.fds = false;
    return this.elementos[this.indice++];
  }

  escribir(valor: Value, pos?: Pos): void {
    if (!this.abierta || this.modo !== "escritura") {
      throw new RuntimeError(
        `Para escribir en "${this.nombre}" primero va CREAR(${this.nombre}).`,
        pos
      );
    }
    this.salida.push(valor);
  }

  cerrar(fs: SistemaDeArchivos): void {
    if (this.abierta && this.modo === "escritura") {
      const texto = this.esDeCaracteres
        ? this.salida.map((v) => String(v)).join("")
        : this.salida.map((v) => formatValue(v)).join(" ");
      fs.escribir(this.nombre, ".txt", texto + "\n");
    }
    this.abierta = false;
  }
}
