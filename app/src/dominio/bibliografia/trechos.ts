/**
 * Referência formatada em trechos (M4-T02): cada trecho guarda o texto, o destaque e a RN de onde veio, para o motor
 * (M4-T05), a prévia do cadastro (M4-T06) e o verificador (M4-T08) usarem a mesma saída.
 */
import type { Id, InlineDeTitulo, MarcaTexto } from '../modelo';

export interface TrechoReferencia {
  texto: string;
  marcas: readonly MarcaTexto[];
  /** RN (ou decisão D-M4) que produziu o trecho. Pontuação de ligação carrega a RN do padrão do tipo. */
  origem: readonly string[];
}

export type CodigoAvisoReferencia =
  | 'ANO_AUSENTE'
  | 'ACESSO_AUSENTE'
  | 'URL_AUSENTE'
  | 'TIPO_SEM_FORMATADOR'
  | 'ELEMENTO_AUSENTE'
  | 'OBRA_INEXISTENTE'
  | 'SOBRENOME_E_ANO_REPETIDOS'
  | 'NARRATIVA_COM_VARIAS_OBRAS';

export interface AvisoReferencia {
  codigo: CodigoAvisoReferencia;
  rn: string;
  mensagem: string;
}

export interface ReferenciaFormatada {
  obra: Id;
  trechos: readonly TrechoReferencia[];
  avisos: readonly AvisoReferencia[];
}

/** Texto corrido da referência, sem destaque (prévia, ordenação, testes). */
export function textoDaReferencia(ref: Pick<ReferenciaFormatada, 'trechos'>): string {
  return ref.trechos.map((t) => t.texto).join('');
}

/**
 * Origens sem fonte no Manual, aplicadas como provisórias (POLÍTICA §2.2; revisão N-M4-06): as decisões D-M4 e as RN
 * PENDENTE-FONTE dos formatadores. A tela mostra quais entraram na referência ou na chamada.
 */
export const ORIGENS_PROVISORIAS: Readonly<Record<string, string>> = {
  'RN-094': 'separador de autores na chamada',
  'RN-095': 'mais de três autores na chamada',
  'RN-096': 'várias obras e mesmo autor e ano',
  'RN-097': 'chamada sem data ou sem página',
  'RN-182': 'prenomes por extenso ou abreviados',
  'RN-193': 'sem local, sem editora ou data incerta',
  'D-M4-02': 'autores na chamada',
  'D-M4-03': 'sufixo a, b e várias obras',
  'D-M4-04': 'data provável e documento sem paginação',
  'D-M4-05': 'forma de elementos sem exemplo no Manual',
  'D-M4-06': 'tipo de obra da primeira leva',
  'D-M4-08': 'chamada sem exemplo no Manual',
};

/** As origens provisórias presentes nos trechos, na ordem em que aparecem, como "descrição (código)". */
export function origensProvisorias(trechos: readonly Pick<TrechoReferencia, 'origem'>[]): string[] {
  const vistas: string[] = [];
  for (const t of trechos) for (const o of t.origem) if (Object.hasOwn(ORIGENS_PROVISORIAS, o) && !vistas.includes(o)) vistas.push(o);
  return vistas.map((o) => `${ORIGENS_PROVISORIAS[o]} (${o})`);
}

/** Montador de trechos com a pontuação de fecho dos elementos ("." sem repetir o ponto de abreviatura). */
export class Montador {
  readonly trechos: TrechoReferencia[] = [];

  texto(texto: string, origem: readonly string[], marcas: readonly MarcaTexto[] = []): this {
    if (texto === '') return this;
    const ultimo = this.trechos.at(-1);
    if (ultimo && mesmas(ultimo.marcas, marcas) && mesmas(ultimo.origem, origem)) {
      this.trechos[this.trechos.length - 1] = { ...ultimo, texto: ultimo.texto + texto };
    } else {
      this.trechos.push({ texto, marcas: [...marcas], origem: [...origem] });
    }
    return this;
  }

  /** Inlines do modelo (título com nome científico em itálico), acrescentando `extra` às marcas de cada um. */
  inlines(conteudo: readonly InlineDeTitulo[], origem: readonly string[], extra: readonly MarcaTexto[] = []): this {
    for (const i of conteudo) this.texto(i.texto, origem, unir(i.marcas ?? [], extra));
    return this;
  }

  /** Fecha o elemento com ponto e espaço; não repete o ponto de "et al.", "M." nem soma ponto a "?" ou "!". */
  ponto(origem: readonly string[]): this {
    this.aparar();
    if (!/[.?!]$/u.test(this.trechos.at(-1)?.texto ?? '')) this.texto('.', origem);
    return this.texto(' ', origem);
  }

  terminaCom(sufixo: string): boolean {
    return this.trechos.at(-1)?.texto.endsWith(sufixo) ?? false;
  }

  /** Tira espaços do fim (antes de pontuar ou ao terminar). */
  aparar(): this {
    while (this.trechos.length > 0) {
      const ultimo = this.trechos.at(-1)!;
      const aparado = ultimo.texto.replace(/\s+$/u, '');
      if (aparado === ultimo.texto) break;
      if (aparado === '') this.trechos.pop();
      else this.trechos[this.trechos.length - 1] = { ...ultimo, texto: aparado };
    }
    return this;
  }

  vazio(): boolean {
    return this.trechos.length === 0;
  }
}

function mesmas<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function unir(a: readonly MarcaTexto[], b: readonly MarcaTexto[]): MarcaTexto[] {
  const saida = [...a];
  for (const m of b) if (!saida.includes(m)) saida.push(m);
  return saida;
}
