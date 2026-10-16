// Montador de ZIP "cru" para testes (M1-T05): permite declarar tamanhos, CRC, nomes e deslocamentos falsos,
// coisa que nenhuma biblioteca de ZIP faz. Só para fabricar pacotes maliciosos nos testes.
import { deflateSync } from 'fflate';
import { crc32 } from '../../src/persistencia/conteiner/crc32';

export interface EntradaBruta {
  nome: string;
  conteudo: Uint8Array;
  metodo?: 0 | 8;
  /** Sobrescritas (crc, descomprimido, comprimido) valem para os dois cabeçalhos, local e central. */
  crc?: number;
  descomprimido?: number;
  /** Tamanho comprimido declarado (padrão: o real). */
  comprimido?: number;
  flags?: number;
  /** Bytes acrescentados depois dos dados comprimidos (contam no tamanho comprimido). */
  sufixo?: Uint8Array;
  /** Bytes de lixo inseridos antes do cabeçalho local desta entrada. */
  lacunaAntes?: number;
  /** Aponta o cabeçalho central para o cabeçalho local de outra entrada (índice). */
  localDe?: number;
}

export function montarZip(entradas: EntradaBruta[], opcoes: { comentario?: string; lacunaFinal?: number } = {}): Uint8Array {
  const partes: Uint8Array[] = [];
  const centrais: Uint8Array[] = [];
  const deslocamentos: number[] = [];
  let pos = 0;
  const texto = (s: string) => new TextEncoder().encode(s);

  const infos = entradas.map((e) => {
    const metodo = e.metodo ?? 8;
    const base = metodo === 8 ? deflateSync(e.conteudo) : e.conteudo;
    const dados = e.sufixo ? new Uint8Array([...base, ...e.sufixo]) : base;
    return {
      e,
      metodo,
      dados,
      nome: texto(e.nome),
      crc: e.crc ?? crc32(e.conteudo),
      descomprimido: e.descomprimido ?? e.conteudo.length,
      comprimido: e.comprimido ?? dados.length,
      flags: e.flags ?? 0,
    };
  });

  for (const i of infos) {
    const local = new Uint8Array(30 + i.nome.length);
    const v = new DataView(local.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, i.flags, true);
    v.setUint16(8, i.metodo, true);
    v.setUint32(14, i.crc, true);
    v.setUint32(18, i.comprimido, true);
    v.setUint32(22, i.descomprimido, true);
    v.setUint16(26, i.nome.length, true);
    local.set(i.nome, 30);
    if (i.e.lacunaAntes) {
      partes.push(new Uint8Array(i.e.lacunaAntes).fill(0x41));
      pos += i.e.lacunaAntes;
    }
    deslocamentos.push(pos);
    partes.push(local, i.dados);
    pos += local.length + i.dados.length;
  }

  if (opcoes.lacunaFinal) {
    partes.push(new Uint8Array(opcoes.lacunaFinal).fill(0x42));
    pos += opcoes.lacunaFinal;
  }
  const inicioCentral = pos;
  infos.forEach((i, indice) => {
    const c = new Uint8Array(46 + i.nome.length);
    const v = new DataView(c.buffer);
    v.setUint32(0, 0x02014b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 20, true);
    v.setUint16(8, i.flags, true);
    v.setUint16(10, i.metodo, true);
    v.setUint32(16, i.crc, true);
    v.setUint32(20, i.comprimido, true);
    v.setUint32(24, i.descomprimido, true);
    v.setUint16(28, i.nome.length, true);
    v.setUint32(42, deslocamentos[i.e.localDe ?? indice]!, true);
    c.set(i.nome, 46);
    centrais.push(c);
    pos += c.length;
  });

  const comentario = texto(opcoes.comentario ?? '');
  const eocd = new Uint8Array(22 + comentario.length);
  const v = new DataView(eocd.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, entradas.length, true);
  v.setUint16(10, entradas.length, true);
  v.setUint32(12, pos - inicioCentral, true);
  v.setUint32(16, inicioCentral, true);
  v.setUint16(20, comentario.length, true);
  eocd.set(comentario, 22);

  const total = [...partes, ...centrais, eocd];
  const saida = new Uint8Array(total.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of total) {
    saida.set(p, o);
    o += p.length;
  }
  return saida;
}
