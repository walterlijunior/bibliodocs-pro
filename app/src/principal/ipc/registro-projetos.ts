/**
 * Arquivos abertos nesta sessão, por identificador opaco (C-12). O caminho fica só no principal; o renderer recebe o
 * identificador e o nome do arquivo. Cada identificador pertence ao `webContents` que o recebeu: outra janela não o usa.
 *
 * Duas instâncias no app: a dos projetos abertos (canais `projetos`) e a dos itens listados pela biblioteca (canais
 * `biblioteca`, M1-T09). Um identificador de item nunca serve para `projetos.salvar`, e vice-versa.
 *
 * A chave comparável do caminho é calculada uma vez, ao registrar, e um índice por (dono, chave) mantém `idPara` em
 * tempo constante: a lista da biblioteca chama `idPara` para cada arquivo (até 5 000; revisão do M1-T09, A1).
 */
import { randomBytes } from 'node:crypto';
import { chaveCaminho } from '../../persistencia';

interface Entrada {
  caminho: string;
  chave: string;
  dono: number;
}

const chaveDono = (dono: number, chave: string) => `${dono}\u0000${chave}`;

export class RegistroProjetos {
  readonly #entradas = new Map<string, Entrada>();
  /** (dono, chave do caminho) → identificador mais recente desse par. */
  readonly #porDono = new Map<string, string>();
  readonly #gerar: () => string;

  constructor(gerar: () => string = () => randomBytes(16).toString('base64url')) {
    this.#gerar = gerar;
  }

  #apagar(id: string, e: Entrada): void {
    this.#entradas.delete(id);
    const k = chaveDono(e.dono, e.chave);
    if (this.#porDono.get(k) === id) this.#porDono.delete(k);
  }

  registrar(caminho: string, dono: number): string {
    let id = this.#gerar();
    while (this.#entradas.has(id)) id = this.#gerar();
    const chave = chaveCaminho(caminho);
    this.#entradas.set(id, { caminho, chave, dono });
    this.#porDono.set(chaveDono(dono, chave), id);
    return id;
  }

  /** Identificador já dado a `dono` para este caminho, ou um novo (a lista da biblioteca mantém as chaves estáveis). */
  idPara(caminho: string, dono: number): string {
    const id = this.#porDono.get(chaveDono(dono, chaveCaminho(caminho)));
    return id !== undefined && this.#entradas.has(id) ? id : this.registrar(caminho, dono);
  }

  /** Caminho do identificador, se ele existe e pertence a `dono`. */
  caminho(id: string, dono: number): string | null {
    const e = this.#entradas.get(id);
    return e && e.dono === dono ? e.caminho : null;
  }

  /** Se algum identificador (de qualquer janela) aponta para o caminho. */
  contem(caminho: string): boolean {
    const chave = chaveCaminho(caminho);
    for (const e of this.#entradas.values()) if (e.chave === chave) return true;
    return false;
  }

  /** O arquivo mudou de nome: os identificadores continuam valendo, com o caminho novo. */
  trocarCaminho(de: string, para: string): void {
    const chave = chaveCaminho(de);
    const nova = chaveCaminho(para);
    for (const [id, e] of this.#entradas) {
      if (e.chave !== chave) continue;
      this.#porDono.delete(chaveDono(e.dono, e.chave));
      e.caminho = para;
      e.chave = nova;
      this.#porDono.set(chaveDono(e.dono, nova), id);
    }
  }

  /** O arquivo deixou de existir: todos os identificadores dele deixam de valer. */
  esquecerCaminho(caminho: string): void {
    const chave = chaveCaminho(caminho);
    for (const [id, e] of this.#entradas) if (e.chave === chave) this.#apagar(id, e);
  }

  /** Mantém de `dono` só os identificadores destes caminhos (os demais saíram da lista). */
  manterSo(dono: number, caminhos: Iterable<string>): void {
    const chaves = new Set<string>();
    for (const c of caminhos) chaves.add(chaveCaminho(c));
    for (const [id, e] of this.#entradas) if (e.dono === dono && !chaves.has(e.chave)) this.#apagar(id, e);
  }

  esquecer(id: string, dono: number): void {
    const e = this.#entradas.get(id);
    if (e?.dono === dono) this.#apagar(id, e);
  }

  /** Janela fechada ou recarregada: todos os identificadores dela deixam de valer. */
  esquecerDono(dono: number): void {
    for (const [id, e] of this.#entradas) if (e.dono === dono) this.#apagar(id, e);
  }

  /** Esquece tudo (a biblioteca mudou de pasta). */
  limpar(): void {
    this.#entradas.clear();
    this.#porDono.clear();
  }

  get tamanho(): number {
    return this.#entradas.size;
  }
}
