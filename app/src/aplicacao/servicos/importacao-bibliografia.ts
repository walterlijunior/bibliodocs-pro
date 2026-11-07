/**
 * Importação de BibTeX e RIS (M4-T09; RF-08): do arquivo à prévia que o usuário confere antes de gravar. Nada entra sem
 * a escolha dele: a tela mostra cada registro com a referência formatada, o que impede gravar, o que ficou de fora do
 * arquivo e se a obra já está no trabalho.
 *
 * - A decodificação do arquivo (UTF-8 ou Windows-1252) fica na tela, que tem o `TextDecoder`.
 * - `prepararImportacao`: lê, põe cada obra na forma única do cadastro (`prepararObra`), valida pelo esquema v1 e
 *   marca as duplicadas (mesmo título, ano e primeiro sobrenome, sem distinguir acentos e maiúsculas).
 */
import { formatarReferencia, lerBibliografiaImportada, tiposComFormatador, type FormatoImportacao } from '../../dominio/bibliografia';
import type { ErroValidacao } from '../../dominio/esquemas';
import type { Obra } from '../../dominio/modelo';
import { prepararObra, validarObra } from './obras';

/** Tamanho máximo do arquivo lido (o leitor ainda corta o texto em 2 milhões de caracteres). */
export const LIMITE_BYTES_IMPORTACAO = 4 * 1024 * 1024;

export interface ItemImportacao {
  origem: string;
  tipoOriginal: string;
  /** Na forma única do cadastro; `null` = tipo não suportado. */
  obra: Obra | null;
  referencia: string;
  /** Avisos da leitura e elementos que faltam na referência. */
  avisos: string[];
  /** Campos do arquivo sem lugar no modelo ou no tipo. */
  ignorados: string[];
  erros: readonly ErroValidacao[];
  /** Já está no trabalho, ou repete um registro anterior do mesmo arquivo. */
  duplicada: boolean;
  /** Pode ser gravada (tipo suportado e válida no formato v1). */
  importavel: boolean;
}

export interface PreviaImportacao {
  formato: FormatoImportacao | null;
  itens: ItemImportacao[];
  avisos: string[];
}

const normal = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

function chaveDuplicada(o: Obra): string {
  const primeiro = o.autores?.[0];
  const autor = primeiro === undefined ? '' : primeiro.tipo === 'pessoa' ? primeiro.sobrenome : primeiro.nome;
  return `${normal(o.titulo.map((i) => i.texto).join(''))}|${o.ano ?? ''}|${normal(autor)}`;
}

export function prepararImportacao(texto: string, existentes: readonly Obra[]): PreviaImportacao {
  const lido = lerBibliografiaImportada(texto);
  const vistas = new Set(existentes.map(chaveDuplicada));
  const comFormatador = new Set(tiposComFormatador());
  const itens = lido.registros.map((r): ItemImportacao => {
    if (r.obra === null) {
      return { origem: r.origem, tipoOriginal: r.tipoOriginal, obra: null, referencia: '', avisos: r.avisos, ignorados: r.ignorados, erros: [], duplicada: false, importavel: false };
    }
    const preparada = prepararObra(r.obra);
    // Campos que o leitor preencheu e o tipo não usa.
    const semLugar = Object.keys(r.obra).filter((k) => k !== 'id' && !(k in preparada) && (r.obra as unknown as Record<string, unknown>)[k] !== undefined);
    const v = validarObra(preparada);
    const obra = v.ok ? v.obra : preparada;
    const ref = comFormatador.has(obra.tipo) ? formatarReferencia(obra) : { trechos: [], avisos: [] };
    const chave = chaveDuplicada(obra);
    const duplicada = vistas.has(chave);
    vistas.add(chave);
    return {
      origem: r.origem,
      tipoOriginal: r.tipoOriginal,
      obra,
      referencia: ref.trechos.map((x) => x.texto).join(''),
      avisos: [...r.avisos, ...ref.avisos.map((a) => `${a.mensagem} (${a.rn})`)],
      ignorados: [...r.ignorados, ...semLugar.map((k) => `${k} (sem lugar neste tipo)`)],
      erros: v.ok ? [] : v.erros,
      duplicada,
      importavel: v.ok,
    };
  });
  return { formato: lido.formato, itens, avisos: lido.avisos };
}
