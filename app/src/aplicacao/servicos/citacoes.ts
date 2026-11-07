/**
 * Citação no editor (M4-T07; RF-07), em funções puras usadas pela tela.
 *
 * - `formatadorDeChamadas`: o texto da chamada como sairá no documento, com as obras atuais do trabalho. O editor guarda
 *   só a ligação; mudar o ano da obra muda todas as chamadas na tela, como no DOCX.
 * - `validarCitacao`: o editor só insere a citação que o formato v1 aceita (página e volume no padrão, obra existente).
 * - `reconhecerChamadasEscritas`: no texto colado, "(CAGLIARI, 2003, p. 12)" ou "Cagliari (2003)" de uma obra cadastrada
 *   vira sugestão de ligação. Nada é ligado sem o usuário aceitar.
 * - `verificarBibliografiaDoDocumento` (M4-T08): o verificador da bibliografia com as opções do perfil.
 */
import { contextoDeChamadas, formatarChamada, origensProvisorias, type AvisoReferencia, type EdicaoNbr10520, type TrechoReferencia } from '../../dominio/bibliografia';
import { formatarCaminho, validarCitacaoV1, type ErroValidacao } from '../../dominio/esquemas';
import type { Documento, InlineCitacao, Obra } from '../../dominio/modelo';
import { verificarBibliografia, type ProblemaBibliografia } from '../../dominio/verificador';
import { PERFIL_UFT_2022 } from '../perfil-padrao';

/** O que o editor guarda da citação: tudo menos o id do nó. */
export type DadosCitacao = Omit<InlineCitacao, 'tipo' | 'id'>;

export interface ChamadaNaTela {
  texto: string;
  trechos: readonly TrechoReferencia[];
  avisos: readonly AvisoReferencia[];
  /** Formas provisórias, sem fonte no Manual (revisão N-M4-06). */
  provisorias: string[];
}

export type FormatadorDeChamadas = (dados: DadosCitacao) => ChamadaNaTela;

/** Id provisório só para formatar e validar (o editor dá o id definitivo ao inserir). */
const ID_PROVISORIO = 'cta_provisorio0001';

/** C-01: a edição da NBR 10520 vem do perfil (2002 no UFT 2022). */
function edicaoDoPerfil(): EdicaoNbr10520 {
  return PERFIL_UFT_2022.parametros['edicaoNbr10520']?.valor === '2023' ? '2023' : '2002';
}

export function formatadorDeChamadas(obras: readonly Obra[], edicao: EdicaoNbr10520 = edicaoDoPerfil()): FormatadorDeChamadas {
  const ctx = contextoDeChamadas(obras);
  return (dados) => {
    const c = formatarChamada({ ...dados, tipo: 'citacao', id: ID_PROVISORIO }, ctx, { edicaoNbr10520: edicao });
    return { texto: c.trechos.map((t) => t.texto).join(''), trechos: c.trechos, avisos: c.avisos, provisorias: origensProvisorias(c.trechos) };
  };
}

export type ResultadoValidacaoCitacao = { ok: true; dados: DadosCitacao } | { ok: false; erros: readonly ErroValidacao[] };

/**
 * Apara página e volume, deixa ausente o que ficou vazio e confere com o esquema v1 e com as obras do trabalho. Os
 * caminhos dos erros começam em `citacao` ("citacao.obras[0].pagina", "citacao.apud.obra").
 */
export function validarCitacao(dados: DadosCitacao, obras: readonly Obra[]): ResultadoValidacaoCitacao {
  const limpar = (o: DadosCitacao['obras'][number]): DadosCitacao['obras'][number] => {
    const volume = o.volume?.trim();
    const pagina = o.pagina?.trim();
    return {
      obra: o.obra,
      ...(volume ? { volume } : {}),
      ...(pagina && !o.semPaginacao ? { pagina } : {}),
      ...(o.semPaginacao ? { semPaginacao: true as const } : {}),
    };
  };
  const limpo: DadosCitacao = {
    forma: dados.forma,
    obras: dados.obras.map(limpar),
    ...(dados.apud ? { apud: limpar(dados.apud) } : {}),
    ...(dados.grifo ? { grifo: dados.grifo } : {}),
  };
  const ids = new Set(obras.map((o) => o.id));
  const erros: ErroValidacao[] = [];
  limpo.obras.forEach((o, i) => {
    if (!ids.has(o.obra)) erros.push({ caminho: formatarCaminho('citacao', ['obras', i, 'obra']), mensagem: 'escolha uma obra da bibliografia' });
  });
  if (limpo.apud && !ids.has(limpo.apud.obra)) erros.push({ caminho: 'citacao.apud.obra', mensagem: 'escolha a obra consultada' });
  const v = validarCitacaoV1({ tipo: 'citacao', id: ID_PROVISORIO, ...limpo });
  if (!v.ok) for (const e of v.erros) if (!erros.some((x) => x.caminho === e.caminho)) erros.push(e);
  return erros.length > 0 ? { ok: false, erros } : { ok: true, dados: limpo };
}

/** Chamada escrita à mão no texto que corresponde a uma obra cadastrada. `inicio` e `fim` são posições no texto. */
export interface ChamadaEscrita {
  inicio: number;
  fim: number;
  texto: string;
  dados: DadosCitacao;
}

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const VOLUME = String.raw`(?:, v\. ([0-9A-Za-z]+))?`;
const PAGINA = String.raw`(?:, p\. ([0-9A-Za-z][0-9A-Za-z–-]*))?`;

/**
 * Procura no texto as chamadas de uma obra só, nas duas formas, com volume e página opcionais: "(CAGLIARI, 2003)",
 * "(Cagliari, 2003, p. 12)", "Cagliari (2003, v. 2, p. 12)". Maiúsculas e minúsculas não distinguem (o texto colado
 * pode vir da edição 2023). Obras com a mesma chamada (mesmo sobrenome e ano sem sufixo) não são sugeridas: a ligação
 * seria um palpite. Chamadas sobrepostas ficam com a primeira.
 */
export function reconhecerChamadasEscritas(texto: string, obras: readonly Obra[], edicao: EdicaoNbr10520 = edicaoDoPerfil()): ChamadaEscrita[] {
  return reconhecedorDeChamadas(obras, edicao)(texto);
}

/**
 * O reconhecedor montado uma vez por lista de obras (revisão R-M4-03): os padrões de todas as obras numa regex só, do
 * mais longo ao mais curto (o mais longo ganha no mesmo ponto). A tela o guarda enquanto as obras não mudam.
 */
export function reconhecedorDeChamadas(obras: readonly Obra[], edicao: EdicaoNbr10520 = edicaoDoPerfil()): (texto: string) => ChamadaEscrita[] {
  const formatar = formatadorDeChamadas(obras, edicao);
  // Prefixo da chamada sem o ")" final (em minúsculas) e as obras que o produzem.
  const padroes = new Map<string, { forma: DadosCitacao['forma']; obras: Obra[] }>();
  for (const obra of obras) {
    if (obra.ano === undefined) continue;
    for (const forma of ['parentetica', 'narrativa'] as const) {
      const r = formatar({ forma, obras: [{ obra: obra.id }] });
      if (r.avisos.some((a) => a.codigo === 'OBRA_INEXISTENTE') || !r.texto.endsWith(')')) continue;
      const chave = r.texto.slice(0, -1).toLocaleLowerCase('pt-BR');
      const atual = padroes.get(chave);
      if (atual) atual.obras.push(obra);
      else padroes.set(chave, { forma, obras: [obra] });
    }
  }
  const unicos = [...padroes.entries()].filter(([, v]) => v.obras.length === 1).map(([k]) => k);
  if (unicos.length === 0) return () => [];
  unicos.sort((a, b) => b.length - a.length);
  const re = new RegExp(String.raw`(?<![\p{L}\p{N}])(${unicos.map(escapar).join('|')})${VOLUME}${PAGINA}\)`, 'giu');
  return (texto) => {
    if (texto.indexOf('(') < 0) return [];
    const saida: ChamadaEscrita[] = [];
    for (const m of texto.matchAll(re)) {
      const [inteiro, prefixo, volume, pagina] = m;
      const p = padroes.get(prefixo!.toLocaleLowerCase('pt-BR'));
      if (!p) continue;
      saida.push({
        inicio: m.index,
        fim: m.index + inteiro.length,
        texto: inteiro,
        dados: { forma: p.forma, obras: [{ obra: p.obras[0]!.id, ...(volume ? { volume } : {}), ...(pagina ? { pagina } : {}) }] },
      });
    }
    return saida;
  };
}

/** Citações × referências e consistência das obras (M4-T08), com a edição da NBR 10520 e a autoria do perfil. */
export function verificarBibliografiaDoDocumento(doc: Documento): ProblemaBibliografia[] {
  return verificarBibliografia(doc, {
    edicaoNbr10520: edicaoDoPerfil(),
    listarTodosAutores: PERFIL_UFT_2022.parametros['autoresReferencia']?.valor === 'todos',
  });
}
