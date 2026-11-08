/**
 * M7/RF-15: consolida as verificações sem alterar o trabalho. Só relata regras presentes e aplicáveis no perfil;
 * regras ausentes ou sem decisão viram diagnósticos técnicos separados, nunca uma garantia de conformidade.
 * A conferência de formatação do DOCX continua na regressão documental, não nesta análise sem layout.
 */
import type { Documento, ElementoPreTextualId, Id } from '../modelo';
import { numerarSecoes, rotulosPosTextuais } from '../numeracao';
import { areaUtilMm, pendenciasPreTextuais, type Perfil, type RegraNormativa } from '../normas';
import { verificarBibliografia, type CodigoProblemaBibliografia } from './bibliografia';
import { conferirSiglas, MAXIMO_PROBLEMAS_SIGLAS } from './siglas';
import { verificarVisuais, type CodigoProblemaVisual, type OpcoesVerificacaoVisuais } from './visuais';

export type LocalConformidade =
  | { tipo: 'preTextual'; elemento: ElementoPreTextualId }
  | { tipo: 'obra'; obra: Id }
  | { tipo: 'texto'; secao: Id; no: Id; trecho?: string }
  | { tipo: 'trabalho' };

export interface NaoConformidade {
  id: string;
  codigo: string;
  gravidade: 'erro' | 'aviso';
  origem: readonly string[];
  mensagem: string;
  sugestao: string;
  local: LocalConformidade;
  /** Critério provisório autorizado; nunca sai como erro normativo definitivo. */
  provisoria?: true;
}

export interface DiagnosticoConformidade {
  codigo: 'REGRA_AUSENTE' | 'REGRA_SEM_DECISAO' | 'REGRA_PENDENTE_FONTE' | 'REGRA_DESATIVADA' | 'LIMITE_RELATORIO';
  origem: readonly string[];
  mensagem: string;
}

export interface RelatorioConformidade {
  problemas: NaoConformidade[];
  diagnosticos: DiagnosticoConformidade[];
}

export type OpcoesConformidade = OpcoesVerificacaoVisuais;
/** Limite técnico de apresentação; o relatório avisa quando a análise precisa continuar após as correções. */
export const MAXIMO_PROBLEMAS_CONFORMIDADE = 5_000;

const SUGESTOES_VISUAIS: Readonly<Record<CodigoProblemaVisual, string>> = {
  SEM_TITULO: 'Edite o elemento e preencha um título que descreva seu conteúdo.',
  SEM_FONTE: 'Edite o elemento e informe sua fonte, inclusive quando elaborado pela própria autoria.',
  TABELA_SEM_DADO_NUMERICO: 'Confira se o conteúdo deve ser apresentado como quadro; mantenha tabela para dados predominantemente numéricos.',
  TABELA_LONGA: 'Confira a tabela exportada e, se passar de página, revise título, cabeçalho e indicações de continuação.',
  RESOLUCAO_BAIXA: 'Escolha uma imagem com mais pixels ou reduza sua largura impressa até atingir a resolução recomendada.',
  REMISSIVA_QUEBRADA: 'Ligue a remissiva a um alvo existente ou retire a chamada quebrada do texto.',
  SEM_REMISSIVA: 'Confira se convém inserir uma remissiva ao elemento no trecho em que ele é discutido.',
  GRAFICO_SEM_TABELA: 'Selecione uma tabela existente como fonte do gráfico ou retire o gráfico.',
  GRAFICO_SEM_DADOS: 'Confira os números e as séries da tabela usada pelo gráfico.',
  GRAFICO_PARCIAL: 'Confira a prévia do gráfico e os avisos sobre os dados que não entraram no desenho.',
  TABELA_SEM_CABECALHO: 'Edite a tabela e indique pelo menos uma linha de cabeçalho para identificar as colunas.',
  EQUACAO_SEM_NUMERO: 'Ative a numeração da equação ou revise a decisão de mantê-la sem número.',
};

const SUGESTOES_BIBLIOGRAFIA: Readonly<Record<CodigoProblemaBibliografia, string>> = {
  REFERENCIAS_AUSENTES: 'Inclua o elemento REFERÊNCIAS para que as obras citadas apareçam no documento exportado.',
  CHAMADA_SEM_LIGACAO: 'Confira a chamada escrita e ligue-a à obra cadastrada pelo comando de inserir citação.',
  OBRA_NAO_CITADA: 'Confira se a obra deve ser citada no texto, incluída entre as não citadas ou retirada do cadastro.',
  CHAMADA_AMBIGUA: 'Confira a identificação dos autores e a distinção entre as obras; a solução depende de confirmação da fonte normativa.',
  GRAFIA_DIVERGENTE: 'Confira se é a mesma pessoa e, nesse caso, use a mesma grafia de autoria em todas as obras.',
  PRENOMES_NAO_UNIFORMES: 'Adote uma forma consistente para os prenomes nas referências, por extenso ou abreviados.',
  CHAMADA_COM_AVISO: 'Abra a citação e confira os dados da chamada apontados na mensagem.',
  REFERENCIA_INCOMPLETA: 'Abra a obra e confira os dados bibliográficos apontados na mensagem.',
};

type Candidato = Omit<NaoConformidade, 'id'>;

function decisaoPreenchida(regra: RegraNormativa, perfil: Perfil): boolean {
  return (regra.parametros?.length ?? 0) > 0 && regra.parametros!.every((p) => perfil.parametros[p]?.valor !== undefined);
}

/** Pretextuais, bibliografia, elementos visuais e siglas; nenhuma correção é aplicada silenciosamente. */
export function avaliarConformidade(doc: Documento, perfil: Perfil, opcoes: OpcoesConformidade = {}): RelatorioConformidade {
  const candidatos: Candidato[] = [];
  let truncado = false;
  const add = (p: Candidato): boolean => {
    if (candidatos.length >= MAXIMO_PROBLEMAS_CONFORMIDADE) { truncado = true; return false; }
    candidatos.push(p);
    return true;
  };
  for (const p of pendenciasPreTextuais(doc, perfil)) {
    if (!add({
      codigo: 'PRE_TEXTUAL_INCOMPLETO',
      gravidade: p.nivel === 'pendencia' ? 'erro' : 'aviso',
      origem: [p.rn],
      mensagem: p.mensagem,
      sugestao: p.nivel === 'pendencia'
        ? 'Abra o elemento pré-textual indicado e preencha ou inclua o que a mensagem aponta.'
        : 'Abra o elemento pré-textual indicado e confira os dados ou a extensão do texto apontados na mensagem.',
      local: { tipo: 'preTextual', elemento: p.elemento },
    })) break;
  }
  const bibliografia = truncado ? [] : verificarBibliografia(doc, {
    edicaoNbr10520: perfil.parametros['edicaoNbr10520']?.valor === '2023' ? '2023' : '2002',
    listarTodosAutores: perfil.parametros['autoresReferencia']?.valor === 'todos',
  });
  for (const p of bibliografia) if (!add({
    codigo: p.codigo, gravidade: p.gravidade, origem: p.origem, mensagem: p.mensagem,
    sugestao: SUGESTOES_BIBLIOGRAFIA[p.codigo], local: p.local,
  })) break;
  const visuais = truncado ? [] : verificarVisuais(doc, { ...opcoes, areaUtilMm: opcoes.areaUtilMm ?? areaUtilMm(perfil) });
  for (const p of visuais) {
    if (!add({
      codigo: p.codigo,
      gravidade: p.nivel === 'pendencia' ? 'erro' : 'aviso',
      origem: p.origem,
      mensagem: p.mensagem,
      sugestao: SUGESTOES_VISUAIS[p.codigo],
      local: { tipo: 'texto', secao: p.secao, no: p.elemento },
    })) break;
  }
  const siglas = truncado ? [] : conferirSiglas(doc);
  for (const p of siglas) if (!add({
    codigo: p.codigo,
    gravidade: p.codigo === 'SIGLA_QUEBRADA' ? 'erro' : 'aviso',
    origem: p.rn,
    mensagem: p.mensagem,
    sugestao: p.codigo === 'SIGLA_QUEBRADA'
      ? 'Cadastre novamente a sigla ou substitua a ligação quebrada no texto.'
      : p.codigo === 'SIGLA_EXTENSO_REPETIDO'
        ? 'Troque a forma por extenso pela sigla ligada ao cadastro (a primeira ocorrência já a apresentou).'
        : 'Confira se o trecho é uma sigla; se for, cadastre a forma por extenso e ligue a ocorrência ao cadastro.',
    local: { tipo: 'texto', secao: p.secao, no: p.no, trecho: p.trecho },
  })) break;

  const regras = new Map(perfil.regras.map((r) => [r.id, r]));
  const diagnosticos = new Map<string, DiagnosticoConformidade>();
  if (truncado) diagnosticos.set('limite', { codigo: 'LIMITE_RELATORIO', origem: [], mensagem: `A análise foi limitada aos primeiros ${MAXIMO_PROBLEMAS_CONFORMIDADE} resultados. Corrija os itens e verifique novamente para continuar a conferência.` });
  if (siglas.length >= MAXIMO_PROBLEMAS_SIGLAS) diagnosticos.set('limiteSiglas', { codigo: 'LIMITE_RELATORIO', origem: ['RN-046'], mensagem: `A conferência de siglas atingiu o limite técnico de ${MAXIMO_PROBLEMAS_SIGLAS} ocorrências; pode haver outras a conferir. Corrija os itens e verifique novamente.` });
  const problemas: Candidato[] = [];
  for (const p of candidatos) {
    const normativas = p.origem.filter((rn) => /^RN-\d{3}$/.test(rn));
    let aplicada = normativas.length === 0;
    // N-M6-07: decisão do projeto (D-…) não é texto de norma; o critério sai marcado como provisório (Política, 2.2).
    let provisoria = p.origem.some((o) => /^D-M\d+-\d+$/.test(o));
    const ativas = new Set<string>();
    for (const rn of normativas) {
      const r = regras.get(rn);
      let diagnostico: DiagnosticoConformidade | undefined;
      if (!r) diagnostico = { codigo: 'REGRA_AUSENTE', origem: [rn], mensagem: `${rn}: verificação não aplicada porque a regra não está no perfil selecionado.` };
      else if (r.tipo === 'verificacao' && r.parametros?.some((p) => perfil.parametros[p]?.valor === false)) {
        diagnostico = { codigo: 'REGRA_DESATIVADA', origem: [rn], mensagem: `${rn}: verificação desativada por opção do perfil selecionado.` };
      }
      else if (r.status === 'AMBIGUA' && !decisaoPreenchida(r, perfil)) {
        diagnostico = { codigo: 'REGRA_SEM_DECISAO', origem: [rn], mensagem: `${rn}: verificação não aplicada porque a regra ambígua aguarda uma decisão.` };
      } else if (r.status === 'PENDENTE-FONTE' && !(r.provisoria === true && decisaoPreenchida(r, perfil))) {
        diagnostico = { codigo: 'REGRA_PENDENTE_FONTE', origem: [rn], mensagem: `${rn}: verificação não aplicada porque falta a fonte ou uma decisão provisória autorizada.` };
      } else {
        aplicada = true;
        ativas.add(rn);
        if (r.status === 'PENDENTE-FONTE' || r.provisoria === true) provisoria = true;
      }
      if (diagnostico) diagnosticos.set(`${rn}:${diagnostico.codigo}`, diagnostico);
    }
    if (aplicada) problemas.push({ ...p, origem: p.origem.filter((rn) => !/^RN-\d{3}$/.test(rn) || ativas.has(rn)), ...(provisoria ? { gravidade: 'aviso', provisoria: true as const } : {}) });
  }
  const peso = { erro: 0, aviso: 1 } as const;
  return {
    problemas: problemas.map((p, ordem) => ({ p, ordem }))
      .sort((a, b) => peso[a.p.gravidade] - peso[b.p.gravidade] || a.ordem - b.ordem)
      .map(({ p }, i) => ({ id: `nc_${String(i + 1).padStart(6, '0')}`, ...p })),
    diagnosticos: [...diagnosticos.values()],
  };
}

export function verificarConformidade(doc: Documento, perfil: Perfil, opcoes: OpcoesConformidade = {}): NaoConformidade[] {
  return avaliarConformidade(doc, perfil, opcoes).problemas;
}

const PRE_TEXTUAIS: Readonly<Record<ElementoPreTextualId, string>> = {
  capa: 'Capa', folhaRosto: 'Folha de rosto', fichaCatalografica: 'Ficha catalográfica', errata: 'Errata',
  folhaAprovacao: 'Folha de aprovação', dedicatoria: 'Dedicatória', agradecimentos: 'Agradecimentos', epigrafe: 'Epígrafe',
  resumo: 'Resumo', abstract: 'Resumo em língua estrangeira', listaIlustracoes: 'Lista de ilustrações',
  listaTabelas: 'Lista de tabelas', listaSiglas: 'Lista de abreviaturas e siglas', listaSimbolos: 'Lista de símbolos', sumario: 'Sumário',
};

/** Texto sem HTML ou caminhos de arquivo, pronto para gravação UTF-8 pela camada principal. */
export function textoRelatorioConformidade(
  doc: Documento,
  problemas: readonly NaoConformidade[],
  diagnosticos: readonly DiagnosticoConformidade[] = [],
): string {
  const secoes = new Map(numerarSecoes(doc.corpo).map((n) => [n.secao.id, `Seção ${n.indicativo} ${n.secao.titulo.map((t) => t.texto).join('')}`.trim()]));
  const posTextuais = rotulosPosTextuais(doc.posTextuais ?? []);
  for (const e of doc.posTextuais ?? []) {
    const rotulo = posTextuais.get(e.id);
    if (rotulo && (e.tipo === 'apendice' || e.tipo === 'anexo')) secoes.set(e.id, `${rotulo}${e.titulo ? ` – ${e.titulo}` : ''}`);
  }
  const local = (l: LocalConformidade): string => {
    if (l.tipo === 'preTextual') return PRE_TEXTUAIS[l.elemento];
    if (l.tipo === 'obra') return `Obra: ${doc.obras?.find((o) => o.id === l.obra)?.titulo.map((t) => t.texto).join('') || l.obra}`;
    if (l.tipo === 'texto') return `${secoes.get(l.secao) ?? `Texto ${l.secao}`}; trecho ${l.no}${l.trecho ? `: ${l.trecho}` : ''}`;
    return 'Trabalho';
  };
  const erros = problemas.filter((p) => p.gravidade === 'erro').length;
  const linhas = [
    'BiblioDocs Pro — Relatório de verificações automáticas',
    `Trabalho: ${doc.metadados.titulo.map((t) => t.texto).join('') || '(sem título)'}`,
    `Resultado: ${erros} erro(s), ${problemas.length - erros} aviso(s).`,
    'Escopo: verificações automáticas implementadas; revise o documento final e as regras ainda não verificadas.',
    '',
  ];
  if (problemas.length === 0) linhas.push('Nenhum problema encontrado nas verificações aplicadas.', '');
  problemas.forEach((p, i) => linhas.push(
    `${i + 1}. ${p.gravidade === 'erro' ? 'ERRO' : 'AVISO'}${p.provisoria ? ' (critério provisório)' : ''} — ${p.codigo}`,
    `Local: ${local(p.local)}`,
    `Origem: ${p.origem.join(', ')}`,
    p.mensagem,
    `Sugestão: ${p.sugestao}`,
    '',
  ));
  if (diagnosticos.length > 0) {
    linhas.push('Regras não verificadas nesta análise:');
    for (const d of diagnosticos) linhas.push(`- ${d.mensagem}`);
    linhas.push('');
  }
  // R-M6-06: cada item é uma linha só. Título, trecho ou mensagem com quebra não forjam linhas ("Resultado: 0 erro(s)")
  // no relatório que o autor entrega a outra pessoa.
  return linhas.map((l) => l.replace(/[\r\n\t\u2028\u2029\v\f]+/g, ' ')).join('\n');
}
