/**
 * Arquivos abertos nesta sessão, por identificador opaco (C-12). O caminho fica só no principal; o renderer recebe o
 * identificador e o nome do arquivo. Cada identificador pertence ao `webContents` que o recebeu: outra janela não o usa.
 *
 * Duas instâncias no app: a dos projetos abertos (canais `projetos`) e a dos itens listados pela biblioteca (canais
 * `biblioteca`, M1-T09). Um identificador de item nunca serve para `projetos.salvar`, e vice-versa.
 *
 * A chave comparável do caminho é calculada uma vez, ao registrar, e um índice por (dono, chave) mantém `idPara` em
 * tempo constante: a lista da biblioteca chama `idPara` para cada arquivo (até 5 000; revisão do M1-T09, A1).
 *
 * Mídias conhecidas (M2-T01, R36): cada identificador de projeto guarda os bytes das mídias do último pacote
 * **conferido** daquele trabalho (lido do arquivo ao abrir, ou empacotado com sucesso numa gravação, o que confere
 * sha256, tamanho, tipo e declaração no manifesto). O renderer manda só a chave delas no instantâneo e no salvar, em
 * vez de dezenas de MB a cada ~2 s. Nada que o renderer mandou entra antes da conferência (revisão do M2-T01, F1), e
 * uma mídia que saiu do pacote sai daqui (F2): se o renderer ainda a referir (desfazer), recebe `MIDIA_AUSENTE` e
 * reenvia com os bytes. Os bytes ficam num `SharedArrayBuffer` (uma cópia, ao guardar): o empacotador (worker) os lê
 * sem que o principal copie 25 MB a cada pedido (medido: 17–24 ms → ~0 ms).
 */
import { randomBytes } from 'node:crypto';
import { chaveCaminho } from '../../persistencia';

interface Entrada {
  caminho: string;
  chave: string;
  dono: number;
  /**
   * Id do projeto conhecido pelo principal (lido do arquivo ou gravado por ele), ou `null`. A recuperação usa este id,
   * nunca o que vem do renderer, para nomear as pastas de instantâneos (revisão do M1-T12, M1).
   */
  idProjeto: string | null;
  /** Bytes das mídias deste trabalho que o principal já tem, pela chave sha256. */
  midias: Map<string, Uint8Array>;
}

const chaveDono = (dono: number, chave: string) => `${dono}\u0000${chave}`;

/** Os mesmos bytes em memória compartilhável com os workers (sem cópia se já estiverem). */
function compartilhado(bytes: Uint8Array): Uint8Array {
  if (bytes.buffer instanceof SharedArrayBuffer) return bytes;
  const copia = new Uint8Array(new SharedArrayBuffer(bytes.byteLength));
  copia.set(bytes);
  return copia;
}

/** As mídias conferidas, reaproveitando a cópia compartilhada das que já estavam guardadas. */
function guardadas(atuais: ReadonlyMap<string, Uint8Array>, midias: ReadonlyMap<string, Uint8Array>): Map<string, Uint8Array> {
  const r = new Map<string, Uint8Array>();
  for (const [sha256, bytes] of midias) r.set(sha256, atuais.get(sha256) ?? compartilhado(bytes));
  return r;
}

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

  registrar(caminho: string, dono: number, idProjeto: string | null = null, midias: ReadonlyMap<string, Uint8Array> = new Map()): string {
    let id = this.#gerar();
    while (this.#entradas.has(id)) id = this.#gerar();
    const chave = chaveCaminho(caminho);
    this.#entradas.set(id, { caminho, chave, dono, idProjeto, midias: guardadas(new Map(), midias) });
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

  /** Id do projeto registrado com o identificador, se ele existe e pertence a `dono`. */
  idProjeto(id: string, dono: number): string | null {
    const e = this.#entradas.get(id);
    return e && e.dono === dono ? e.idProjeto : null;
  }

  /** Mídias conhecidas do identificador, se ele existe e pertence a `dono`. */
  midias(id: string, dono: number): ReadonlyMap<string, Uint8Array> | null {
    const e = this.#entradas.get(id);
    return e && e.dono === dono ? e.midias : null;
  }

  /**
   * As mídias conhecidas do identificador passam a ser as de um pacote **já conferido** pelo empacotamento (nunca as
   * de um pacote só recebido do renderer).
   */
  trocarMidias(id: string, dono: number, midias: ReadonlyMap<string, Uint8Array>): void {
    const e = this.#entradas.get(id);
    if (e?.dono === dono) e.midias = guardadas(e.midias, midias);
  }

  /** Se algum identificador (de qualquer janela) aponta para o caminho. */
  contem(caminho: string): boolean {
    const chave = chaveCaminho(caminho);
    for (const e of this.#entradas.values()) if (e.chave === chave) return true;
    return false;
  }

  /** Se `dono` ainda tem algum identificador para o caminho. */
  contemDe(caminho: string, dono: number): boolean {
    const chave = chaveCaminho(caminho);
    for (const e of this.#entradas.values()) if (e.dono === dono && e.chave === chave) return true;
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
