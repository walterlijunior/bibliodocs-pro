/**
 * Leitura defensiva de ZIP em memória (ADR-0004, seção 3), sem extrair para o disco.
 *
 * A estrutura é analisada aqui, não por biblioteca: o `inflateSync` do fflate com saída fixa trunca em silêncio e o
 * `unzipSync` confia nos tamanhos declarados [VERIFICADO no M1-T05]. Este leitor:
 * - aceita só o ZIP que o próprio app grava: sem ZIP64, criptografia, descritor de dados, comentário ou multivolume;
 *   métodos 0 e 8; entradas contíguas desde o byte 0 até o diretório central (sem lacunas nem sobreposição);
 * - confere o diretório central contra o cabeçalho local de cada entrada (nome, flags, método, CRC, tamanhos);
 * - confere nome, tamanho declarado, razão de compressão e soma ANTES de descomprimir;
 * - descomprime **sob demanda** (`ler()`), para quem chama validar na ordem e não descomprimir o que vai recusar;
 * - usa `node:zlib` com `maxOutputLength` (interrompe ao passar do tamanho declarado), exige que o fluxo deflate termine
 *   exatamente no fim dos dados da entrada e confere o tamanho real e o CRC-32.
 */
import { inflateRawSync } from 'node:zlib';
import type { ErroValidacao } from '../../dominio/esquemas';
import { crc32 } from './crc32';
import type { LimitesConteiner } from './limites';

export type ResultadoEntrada = { ok: true; dados: Uint8Array } | { ok: false; erro: ErroValidacao };

export interface EntradaZip {
  nome: string;
  metodo: 0 | 8;
  /** Posição do cabeçalho local no arquivo (0 = primeira entrada física). */
  deslocamento: number;
  /** Tamanho descomprimido declarado (já conferido contra os limites). */
  bytes: number;
  /** Descomprime e confere a entrada. Os bytes devolvidos são uma cópia independente do arquivo. */
  ler(): ResultadoEntrada;
}

export type ResultadoZip = { ok: true; entradas: EntradaZip[] } | { ok: false; erros: ErroValidacao[] };

/** Devolve o limite de bytes descomprimidos da entrada, ou `null` se o nome não é permitido. */
export type PoliticaNomes = (nome: string) => number | null;

interface Central {
  nome: string;
  flags: number;
  metodo: number;
  crc: number;
  comprimido: number;
  descomprimido: number;
  deslocamentoLocal: number;
  inicioDados: number;
}

const ASS_EOCD = 0x06054b50;
const ASS_CENTRAL = 0x02014b50;
const ASS_LOCAL = 0x04034b50;
const FLAG_CRIPTOGRAFIA = 0x0001;
const FLAG_UTF8 = 0x0800;
const FLAGS_ACEITAS = FLAG_UTF8 | 0x0006; // bits 1–2: opções do deflate. Descritor de dados (bit 3) não é aceito.

class ErroZip extends Error {
  constructor(
    readonly caminho: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

function falhar(caminho: string, mensagem: string): never {
  throw new ErroZip(caminho, mensagem);
}

function lerNome(bytes: Uint8Array): string {
  // Nomes permitidos são ASCII; latin1 preserva cada byte e deixa a política recusar o resto.
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return s;
}

/** Cópia que não compartilha memória com o arquivo nem com o pool de `Buffer` do Node. */
function copiar(origem: Uint8Array): Uint8Array {
  const copia = new Uint8Array(origem.length);
  copia.set(origem);
  return copia;
}

function lerCentral(dados: Uint8Array, limites: LimitesConteiner, politica: PoliticaNomes): Central[] {
  const v = new DataView(dados.buffer, dados.byteOffset, dados.byteLength);
  const fim = dados.length - 22;
  if (fim < 0 || v.getUint32(fim, true) !== ASS_EOCD) {
    falhar('arquivo', 'não é um projeto válido: fim do ZIP não encontrado (arquivo truncado, com comentário ou de outro formato)');
  }
  const disco = v.getUint16(fim + 4, true);
  const discoCentral = v.getUint16(fim + 6, true);
  const nesteDisco = v.getUint16(fim + 8, true);
  const total = v.getUint16(fim + 10, true);
  const tamanhoCentral = v.getUint32(fim + 12, true);
  const inicioCentral = v.getUint32(fim + 16, true);
  if (disco !== 0 || discoCentral !== 0 || nesteDisco !== total) falhar('arquivo', 'ZIP em vários volumes não é aceito');
  if (total === 0xffff || tamanhoCentral === 0xffffffff || inicioCentral === 0xffffffff) falhar('arquivo', 'ZIP64 não é aceito');
  if (total > limites.entradas) falhar('arquivo', `entradas demais no pacote (${total}; limite ${limites.entradas})`);
  if (inicioCentral + tamanhoCentral !== fim) falhar('arquivo', 'diretório central do ZIP inconsistente');

  const entradas: Central[] = [];
  const nomes = new Set<string>();
  let p = inicioCentral;
  for (let i = 0; i < total; i++) {
    if (p + 46 > fim || v.getUint32(p, true) !== ASS_CENTRAL) falhar('arquivo', 'diretório central do ZIP corrompido');
    const flags = v.getUint16(p + 8, true);
    const metodo = v.getUint16(p + 10, true);
    const crc = v.getUint32(p + 16, true);
    const comprimido = v.getUint32(p + 20, true);
    const descomprimido = v.getUint32(p + 24, true);
    const tamNome = v.getUint16(p + 28, true);
    const tamExtra = v.getUint16(p + 30, true);
    const tamComentario = v.getUint16(p + 32, true);
    const discoInicio = v.getUint16(p + 34, true);
    const deslocamentoLocal = v.getUint32(p + 42, true);
    if (p + 46 + tamNome + tamExtra + tamComentario > fim) falhar('arquivo', 'diretório central do ZIP corrompido');
    const nome = lerNome(dados.subarray(p + 46, p + 46 + tamNome));
    p += 46 + tamNome + tamExtra + tamComentario;

    const limite = politica(nome);
    if (limite === null) falhar(nome, 'nome de entrada não permitido no pacote');
    if (nomes.has(nome)) falhar(nome, 'entrada repetida no pacote');
    nomes.add(nome);
    if (flags & FLAG_CRIPTOGRAFIA) falhar(nome, 'entrada criptografada não é aceita');
    if (flags & ~FLAGS_ACEITAS) falhar(nome, 'opções de ZIP não suportadas');
    if (metodo !== 0 && metodo !== 8) falhar(nome, `método de compressão não suportado (${metodo})`);
    if (discoInicio !== 0) falhar(nome, 'ZIP em vários volumes não é aceito');
    if (comprimido === 0xffffffff || descomprimido === 0xffffffff || deslocamentoLocal === 0xffffffff) falhar(nome, 'ZIP64 não é aceito');
    if (descomprimido > limite) falhar(nome, `entrada grande demais (${descomprimido} bytes; limite ${limite})`);
    if (metodo === 0 && comprimido !== descomprimido) falhar(nome, 'entrada sem compressão com tamanhos divergentes');
    if (descomprimido > limites.pisoRazao && descomprimido > Math.max(comprimido, 1) * limites.razaoCompressao) {
      falhar(nome, `razão de compressão acima do limite (${limites.razaoCompressao}:1)`);
    }
    entradas.push({ nome, flags, metodo, crc, comprimido, descomprimido, deslocamentoLocal, inicioDados: 0 });
  }
  if (p !== fim) falhar('arquivo', 'diretório central do ZIP inconsistente');

  const soma = entradas.reduce((s, e) => s + e.descomprimido, 0);
  if (soma > limites.bytesDescomprimidosTotal) falhar('arquivo', `conteúdo descomprimido grande demais (limite ${limites.bytesDescomprimidosTotal} bytes)`);

  // Cabeçalhos locais: coerentes com o central e contíguos do byte 0 até o diretório central.
  let esperado = 0;
  for (const e of [...entradas].sort((a, b) => a.deslocamentoLocal - b.deslocamentoLocal)) {
    const o = e.deslocamentoLocal;
    if (o !== esperado || o + 30 > inicioCentral || v.getUint32(o, true) !== ASS_LOCAL) {
      falhar(e.nome, 'cabeçalho local ausente, sobreposto, fora de ordem ou com lacuna');
    }
    const tamNome = v.getUint16(o + 26, true);
    const tamExtra = v.getUint16(o + 28, true);
    if (o + 30 + tamNome > inicioCentral) falhar(e.nome, 'cabeçalho local corrompido');
    const nomeLocal = lerNome(dados.subarray(o + 30, o + 30 + tamNome));
    if (
      nomeLocal !== e.nome ||
      v.getUint16(o + 6, true) !== e.flags ||
      v.getUint16(o + 8, true) !== e.metodo ||
      v.getUint32(o + 14, true) !== e.crc ||
      v.getUint32(o + 18, true) !== e.comprimido ||
      v.getUint32(o + 22, true) !== e.descomprimido
    ) {
      falhar(e.nome, 'cabeçalho local diverge do diretório central');
    }
    e.inicioDados = o + 30 + tamNome + tamExtra;
    esperado = e.inicioDados + e.comprimido;
    if (esperado > inicioCentral) falhar(e.nome, 'dados da entrada fora da área de dados do ZIP');
  }
  if (esperado !== inicioCentral) falhar('arquivo', 'dados não declarados entre as entradas e o diretório central');
  return entradas;
}

function descomprimir(dados: Uint8Array, e: Central): Uint8Array {
  const comprimido = dados.subarray(e.inicioDados, e.inicioDados + e.comprimido);
  let saida: Uint8Array;
  if (e.metodo === 0) {
    saida = copiar(comprimido);
  } else {
    let resultado: { buffer: Buffer; engine: { bytesWritten: number } };
    try {
      // `info: true` devolve também o motor, cujo `bytesWritten` é quanto da entrada foi consumido.
      resultado = inflateRawSync(comprimido, { info: true, maxOutputLength: Math.max(e.descomprimido, 1) }) as unknown as typeof resultado;
    } catch (erro) {
      if ((erro as { code?: string }).code === 'ERR_BUFFER_TOO_LARGE') falhar(e.nome, 'conteúdo maior que o tamanho declarado (possível zip bomb)');
      falhar(e.nome, 'dados comprimidos inválidos');
    }
    if (resultado.engine.bytesWritten !== comprimido.length) falhar(e.nome, 'dados extras após o fim da compressão');
    saida = copiar(resultado.buffer);
  }
  if (saida.length !== e.descomprimido) falhar(e.nome, 'conteúdo com tamanho diferente do declarado');
  if (crc32(saida) !== e.crc) falhar(e.nome, 'CRC-32 não confere (arquivo corrompido)');
  return saida;
}

/**
 * Confere a estrutura do ZIP e devolve as entradas sem descomprimir nada.
 * Qualquer problema estrutural recusa o pacote inteiro.
 */
export function lerZip(dados: Uint8Array, limites: LimitesConteiner, politica: PoliticaNomes): ResultadoZip {
  try {
    if (dados.length > limites.bytesArquivo) falhar('arquivo', `arquivo grande demais (limite ${limites.bytesArquivo} bytes)`);
    const entradas = lerCentral(dados, limites, politica).map(
      (e): EntradaZip => ({
        nome: e.nome,
        metodo: e.metodo as 0 | 8,
        deslocamento: e.deslocamentoLocal,
        bytes: e.descomprimido,
        ler: () => {
          try {
            return { ok: true, dados: descomprimir(dados, e) };
          } catch (erro) {
            if (erro instanceof ErroZip) return { ok: false, erro: { caminho: erro.caminho, mensagem: erro.message } };
            throw erro;
          }
        },
      }),
    );
    return { ok: true, entradas };
  } catch (erro) {
    if (erro instanceof ErroZip) return { ok: false, erros: [{ caminho: erro.caminho, mensagem: erro.message }] };
    throw erro;
  }
}
