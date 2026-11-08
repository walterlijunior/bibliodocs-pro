/**
 * Figura no editor (M5-T06; RF-10; RNF-17; D-M5-09), em funções puras usadas pela janela da figura.
 *
 * - Rascunho: espécie, título, imagem (sha256), largura, fonte e nota. Campo de texto como na tabela: sem mudança volta
 *   com as marcas; alterado volta como texto simples (D-M5-26).
 * - `avaliarImagem`: largura impressa, resolução efetiva e o aviso abaixo de 150 ppi, com a área útil do perfil.
 * - `validarFigura`: só sai a ilustração que o formato v1 aceita.
 */
import { LIMITES_V1, validarIlustracaoV1 } from '../../dominio/esquemas';
import { ESPECIES_ILUSTRACAO, type BlocoIlustracao, type EspecieIlustracao, type InlineDeTitulo } from '../../dominio/modelo';
import { areaUtilMm } from '../../dominio/normas';
import { avisoDeResolucao } from '../../dominio/verificador';
import { larguraImpressaMm, PALAVRA_DESIGNATIVA, resolucaoEfetivaPpi, type InfoImagem } from '../../dominio/visuais';
import { PERFIL_UFT_2022 } from '../perfil-padrao';
import type { CampoTexto, ErroTabela } from './tabelas';
import { campoDe } from './tabelas';

/** O que o editor guarda da figura: tudo menos o id do nó. */
export type DadosFigura = Omit<BlocoIlustracao, 'id'>;

export interface RascunhoFigura {
  especie: EspecieIlustracao;
  titulo: CampoTexto;
  /** sha256 da imagem escolhida; `null` antes de escolher. */
  midia: string | null;
  /** Largura impressa escolhida, em mm; `null` = natural (limitada à área útil). */
  larguraMm: number | null;
  fonte: CampoTexto;
  nota: CampoTexto;
}

export type ResultadoValidacaoFigura = { ok: true; dados: DadosFigura } | { ok: false; erros: readonly ErroTabela[] };

/** Espécies na ordem da RN-049, com a palavra designativa (o que aparece antes do número). */
export const ESPECIES_FIGURA: readonly { especie: EspecieIlustracao; nome: string }[] = ESPECIES_ILUSTRACAO.map((especie) => ({
  especie,
  nome: PALAVRA_DESIGNATIVA[especie],
}));

export const LARGURA_FIGURA_MM = LIMITES_V1.larguraIlustracaoMm;

const ID_PROVISORIO = 'ilu_provisorio0001';

export const rascunhoFiguraNova = (): RascunhoFigura => ({
  especie: 'figura',
  titulo: { texto: '' },
  midia: null,
  larguraMm: null,
  fonte: { texto: '' },
  nota: { texto: '' },
});

export const rascunhoDeFigura = (d: DadosFigura): RascunhoFigura => ({
  especie: d.especie,
  titulo: campoDe(d.titulo),
  midia: d.midia,
  larguraMm: d.larguraMm ?? null,
  fonte: campoDe(d.fonte),
  nota: campoDe(d.nota),
});

const plano = (c: readonly InlineDeTitulo[]): string => c.map((i) => i.texto).join('');
function conteudoDe(c: CampoTexto): InlineDeTitulo[] {
  if (c.original !== undefined && c.texto === plano(c.original)) return [...c.original];
  const t = c.texto.trim();
  return t === '' ? [] : [{ tipo: 'texto', texto: t }];
}

/** Largura impressa, resolução efetiva e o aviso de resolução (RNF-17), na área útil do perfil padrão. */
export function avaliarImagem(info: InfoImagem, bytes: Uint8Array, larguraMm: number | null): { larguraMm: number; ppi: number; aviso: string | null; areaUtilMm: number } {
  const area = areaUtilMm(PERFIL_UFT_2022);
  const largura = larguraImpressaMm(info, larguraMm ?? undefined, area);
  return { larguraMm: largura, ppi: resolucaoEfetivaPpi(info, largura), aviso: avisoDeResolucao(bytes, larguraMm ?? undefined, area), areaUtilMm: area };
}

export function validarFigura(r: RascunhoFigura): ResultadoValidacaoFigura {
  const erros: ErroTabela[] = [];
  if (r.midia === null) erros.push({ campo: 'Imagem', mensagem: 'escolha um arquivo PNG ou JPEG' });
  if (r.titulo.texto.trim() === '') erros.push({ campo: 'Título', mensagem: 'escreva o título (RN-050)' });
  if (r.larguraMm !== null && (!Number.isInteger(r.larguraMm) || r.larguraMm < LARGURA_FIGURA_MM.minimo || r.larguraMm > LARGURA_FIGURA_MM.maximo)) {
    erros.push({ campo: 'Largura', mensagem: `use um número inteiro de ${LARGURA_FIGURA_MM.minimo} a ${LARGURA_FIGURA_MM.maximo} mm, ou deixe em branco` });
  }
  if (erros.length > 0) return { ok: false, erros };
  const fonte = conteudoDe(r.fonte);
  const nota = conteudoDe(r.nota);
  const dados: DadosFigura = {
    tipo: 'ilustracao',
    especie: r.especie,
    titulo: conteudoDe(r.titulo),
    midia: r.midia!,
    ...(r.larguraMm !== null ? { larguraMm: r.larguraMm } : {}),
    ...(fonte.length > 0 ? { fonte } : {}),
    ...(nota.length > 0 ? { nota } : {}),
  };
  const v = validarIlustracaoV1({ ...dados, id: ID_PROVISORIO });
  if (!v.ok) {
    const nome = (c: string) => ({ titulo: 'Título', fonte: 'Fonte', nota: 'Nota', larguraMm: 'Largura', midia: 'Imagem' })[/^ilustracao\.(\w+)/.exec(c)?.[1] ?? ''] ?? 'Figura';
    return { ok: false, erros: v.erros.map((e) => ({ campo: nome(e.caminho), mensagem: e.mensagem })) };
  }
  return { ok: true, dados };
}

/** Largura da área útil do perfil padrão, em mm (largura máxima da figura e do gráfico gerado, M5-T09). */
export const areaUtilDoPerfilMm = (): number => areaUtilMm(PERFIL_UFT_2022);

