/**
 * Arquivos abertos nesta sessão, por identificador opaco (C-12). O caminho fica só no principal; o renderer recebe o
 * identificador e o nome do arquivo. Cada identificador pertence ao `webContents` que o recebeu: outra janela não o usa.
 */
import { randomBytes } from 'node:crypto';

interface Entrada {
  caminho: string;
  dono: number;
}

export class RegistroProjetos {
  readonly #entradas = new Map<string, Entrada>();
  readonly #gerar: () => string;

  constructor(gerar: () => string = () => randomBytes(16).toString('base64url')) {
    this.#gerar = gerar;
  }

  registrar(caminho: string, dono: number): string {
    let id = this.#gerar();
    while (this.#entradas.has(id)) id = this.#gerar();
    this.#entradas.set(id, { caminho, dono });
    return id;
  }

  /** Caminho do identificador, se ele existe e pertence a `dono`. */
  caminho(id: string, dono: number): string | null {
    const e = this.#entradas.get(id);
    return e && e.dono === dono ? e.caminho : null;
  }

  esquecer(id: string, dono: number): void {
    if (this.#entradas.get(id)?.dono === dono) this.#entradas.delete(id);
  }

  /** Janela fechada ou recarregada: todos os identificadores dela deixam de valer. */
  esquecerDono(dono: number): void {
    for (const [id, e] of this.#entradas) if (e.dono === dono) this.#entradas.delete(id);
  }

  get tamanho(): number {
    return this.#entradas.size;
  }
}
