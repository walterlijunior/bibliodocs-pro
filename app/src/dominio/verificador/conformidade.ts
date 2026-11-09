/**
 * M7/RF-15: consolida as verificações sem alterar o trabalho. Só relata regras presentes e aplicáveis no perfil;
 * regras ausentes ou sem decisão viram diagnósticos técnicos separados, nunca uma garantia de conformidade.
 * A conferência de formatação do DOCX continua na regressão documental, não nesta análise sem layout.
 */
import type { Documento, ElementoPreTextualId, Id } from '../modelo';
import { numerarElementos, numerarSecoes, rotuloEquacao, rotulosPosTextuais } from '../numeracao';
import { rotuloElemento } from '../visuais';
import { areaUtilMm, pendenciasPreTextuais, type Perfil, type RegraNormativa } from '../normas';
import { verificarBibliografia, type CodigoProblemaBibliografia } from './bibliografia';
import { conferirSiglas, MAXIMO_PROBLEMAS_SIGLAS } from './siglas';
import { verificarTabelas, type CodigoProblemaTabela } from './tabelas';
import { MAXIMO_PROBLEMAS_TEXTO, verificarTexto, type CodigoProblemaTexto } from './texto';
import { verificarVisuais, type CodigoProblemaVisual, type OpcoesVerificacaoVisuais } from './visuais';

export type LocalConformidade =
  | { tipo: 'preTextual'; elemento: ElementoPreTextualId }
  | { tipo: 'obra'; obra: Id }
  | { tipo: 'texto'; secao: Id; no: Id; trecho?: string }
  | { tipo: 'trabalho' };

/** Família da verificação, para agrupar na tela e no relatório (M7-T03). */
export type FamiliaConformidade = 'preTextual' | 'bibliografia' | 'visual' | 'tabela' | 'texto' | 'sigla';
/** Ordem e nomes das famílias na tela e no relatório. */
export const FAMILIAS_CONFORMIDADE: readonly { familia: FamiliaConformidade; nome: string }[] = [
  { familia: 'preTextual', nome: 'Elementos pré-textuais' },
  { familia: 'texto', nome: 'Texto e seções' },
  { familia: 'bibliografia', nome: 'Citações e referências' },
  { familia: 'visual', nome: 'Tabelas, quadros, ilustrações e equações' },
  { familia: 'tabela', nome: 'Apresentação das tabelas (Norma Tabular do IBGE)' },
  { familia: 'sigla', nome: 'Siglas' },
];

export interface NaoConformidade {
  id: string;
  codigo: string;
  familia: FamiliaConformidade;
  /** Local para ler: "Seção 2.1 Método — Tabela 3", "Ficha catalográfica", "Obra: Título". */
  rotuloLocal: string;
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

const SUGESTOES_TEXTO: Readonly<Record<CodigoProblemaTexto, string>> = {
  TITULO_CAIXA_ALTA: 'Reescreva o título com só a inicial maiúscula, mantendo maiúsculas apenas em nomes próprios e siglas.',
  TITULO_COM_INDICATIVO: 'Apague o número digitado no início do título; o indicativo é gerado pelo aplicativo.',
  SUPRESSAO_FORA_DO_PADRAO: 'Troque a marca de supressão por [...], entre colchetes, como pede o Manual.',
  TITULO_VAZIO: 'Escreva o título da seção ou retire a seção, se ela sobrou.',
  SECAO_SEM_TEXTO: 'Escreva o texto da seção ou retire-a, se ela sobrou.',
};

const SUGESTOES_TABELA: Readonly<Record<CodigoProblemaTabela, string>> = {
  TABELA_TITULO_SIGLA: 'Escreva no título a forma por extenso da sigla (a natureza e a abrangência dos dados).',
  TABELA_SEM_INDICADOR: 'Edite a tabela e escreva no cabeçalho da primeira coluna o que as linhas indicam.',
  TABELA_CELULA_FORA_DOS_SINAIS: 'Preencha a célula com o dado ou com o sinal convencional que explica a ausência (-, .., ..., X) e explique os sinais na nota geral.',
  TABELA_FONTE_SIGLA: 'Escreva a fonte por extenso; a sigla pode acompanhar a forma por extenso.',
  TABELA_SERIE_TEMPORAL: 'Use hífen entre os anos se a série é consecutiva (1981-1985) ou barra se não é (1981/1985).',
  TABELA_CLASSE_ABERTA: 'Feche a primeira e a última classe com os dois extremos, por exemplo “0 a menos de 5”.',
  TABELA_TOTAL_DIVERGENTE: 'Confira a soma; se a diferença vem do arredondamento, explique-a numa nota geral.',
  TABELA_SINAIS_DEMAIS: 'Confira se a tabela é a melhor forma de apresentar esses dados, ou se convém reorganizá-la.',
  TABELA_OUTROS_MAIOR: 'Confira se convém detalhar a classificação “Outros” em categorias próprias.',
  TABELA_TITULO_PONTO: 'Retire o ponto final do título da tabela.',
};

type Candidato = Omit<NaoConformidade, 'id' | 'rotuloLocal'>;

function decisaoPreenchida(regra: RegraNormativa, perfil: Perfil): boolean {
  return (regra.parametros?.length ?? 0) > 0 && regra.parametros!.every((p) => perfil.parametros[p]?.valor !== undefined);
}

/** Pretextuais, bibliografia, elementos visuais, tabelas (IBGE), texto e siglas; nenhuma correção é aplicada silenciosamente. */
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
      familia: 'preTextual',
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
    familia: 'bibliografia', codigo: p.codigo, gravidade: p.gravidade, origem: p.origem, mensagem: p.mensagem,
    sugestao: SUGESTOES_BIBLIOGRAFIA[p.codigo], local: p.local,
  })) break;
  const visuais = truncado ? [] : verificarVisuais(doc, { ...opcoes, areaUtilMm: opcoes.areaUtilMm ?? areaUtilMm(perfil) });
  for (const p of visuais) {
    if (!add({
      familia: 'visual',
      codigo: p.codigo,
      gravidade: p.nivel === 'pendencia' ? 'erro' : 'aviso',
      origem: p.origem,
      mensagem: p.mensagem,
      sugestao: SUGESTOES_VISUAIS[p.codigo],
      local: { tipo: 'texto', secao: p.secao, no: p.elemento },
    })) break;
  }
  const tabelas = truncado ? [] : verificarTabelas(doc);
  for (const p of tabelas) if (!add({
    familia: 'tabela', codigo: p.codigo, gravidade: 'aviso', origem: p.origem, mensagem: p.mensagem, sugestao: SUGESTOES_TABELA[p.codigo],
    local: { tipo: 'texto', secao: p.secao, no: p.elemento, ...(p.trecho ? { trecho: p.trecho } : {}) },
  })) break;
  const texto = truncado ? [] : verificarTexto(doc);
  for (const p of texto) if (!add({
    familia: 'texto', codigo: p.codigo, gravidade: 'aviso', origem: p.origem, mensagem: p.mensagem, sugestao: SUGESTOES_TEXTO[p.codigo],
    local: { tipo: 'texto', secao: p.secao, no: p.no, ...(p.trecho ? { trecho: p.trecho } : {}) },
  })) break;
  const siglas = truncado ? [] : conferirSiglas(doc);
  for (const p of siglas) if (!add({
    familia: 'sigla', codigo: p.codigo,
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
  if (texto.length >= MAXIMO_PROBLEMAS_TEXTO) diagnosticos.set('limiteTexto', { codigo: 'LIMITE_RELATORIO', origem: [], mensagem: `A conferência do texto atingiu o limite técnico de ${MAXIMO_PROBLEMAS_TEXTO} ocorrências; pode haver outras a conferir. Corrija os itens e verifique novamente.` });
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
  const rotular = rotuladorDeLocais(doc);
  return {
    problemas: problemas.map((p, ordem) => ({ p, ordem }))
      .sort((a, b) => peso[a.p.gravidade] - peso[b.p.gravidade] || a.ordem - b.ordem)
      .map(({ p }, i) => ({ id: `nc_${String(i + 1).padStart(6, '0')}`, ...p, rotuloLocal: rotular(p.local) })),
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

/**
 * Rotulador de locais para ler (M7-T03): seção com indicativo e título, ou apêndice/anexo com a letra; o elemento numerado
 * do local ("Tabela 3", "Equação (2)") no lugar do id interno; o trecho entre aspas.
 */
export function rotuladorDeLocais(doc: Documento): (l: LocalConformidade) => string {
  const secoes = new Map(numerarSecoes(doc.corpo).map((n) => [n.secao.id, `Seção ${n.indicativo} ${n.secao.titulo.map((t) => t.tipo === 'texto' ? t.texto : '').join('')}`.trim()]));
  const posTextuais = rotulosPosTextuais(doc.posTextuais ?? []);
  for (const e of doc.posTextuais ?? []) {
    const rotulo = posTextuais.get(e.id);
    if (rotulo && (e.tipo === 'apendice' || e.tipo === 'anexo')) secoes.set(e.id, `${rotulo}${e.titulo ? ` – ${e.titulo}` : ''}`);
  }
  let elementos: Map<string, string> | null = null;
  const elemento = (id: string): string | undefined => {
    if (!elementos) {
      const n = numerarElementos(doc);
      elementos = new Map([
        ...n.elementos.map((e) => [e.bloco.id, rotuloElemento(e.sequencia, e.numero)] as const),
        ...n.equacoes.map((e) => [e.bloco.id, `Equação ${rotuloEquacao(e.numero)}`] as const),
      ]);
    }
    return elementos.get(id);
  };
  return (l) => {
    if (l.tipo === 'preTextual') return PRE_TEXTUAIS[l.elemento];
    if (l.tipo === 'obra') return `Obra: ${doc.obras?.find((o) => o.id === l.obra)?.titulo.map((t) => t.texto).join('') || '(obra excluída)'}`;
    if (l.tipo === 'texto') {
      const e = elemento(l.no);
      return `${secoes.get(l.secao) ?? 'Texto'}${e ? ` — ${e}` : ''}${l.trecho ? `: “${l.trecho}”` : ''}`;
    }
    return 'Trabalho';
  };
}

/** Texto sem HTML ou caminhos de arquivo, pronto para gravação UTF-8 pela camada principal. */
export function textoRelatorioConformidade(
  doc: Documento,
  problemas: readonly NaoConformidade[],
  diagnosticos: readonly DiagnosticoConformidade[] = [],
): string {
  const local = rotuladorDeLocais(doc);
  const erros = problemas.filter((p) => p.gravidade === 'erro').length;
  const linhas = [
    'BiblioDocs Pro — Relatório de verificações automáticas',
    `Trabalho: ${doc.metadados.titulo.map((t) => t.texto).join('') || '(sem título)'}`,
    `Resultado: ${erros} erro(s), ${problemas.length - erros} aviso(s).`,
    'Escopo: verificações automáticas implementadas; revise o documento final e as regras ainda não verificadas.',
    '',
  ];
  if (problemas.length === 0) linhas.push('Nenhum problema encontrado nas verificações aplicadas.', '');
  // M7-T03: agrupado por família, na ordem da tela; a numeração dos itens segue contínua.
  let n = 0;
  for (const f of FAMILIAS_CONFORMIDADE) {
    const grupo = problemas.filter((p) => p.familia === f.familia);
    if (grupo.length === 0) continue;
    linhas.push(`== ${f.nome} (${grupo.length}) ==`, '');
    for (const p of grupo) linhas.push(
    `${++n}. ${p.gravidade === 'erro' ? 'ERRO' : 'AVISO'}${p.provisoria ? ' (critério provisório)' : ''} — ${p.codigo}`,
    `Local: ${local(p.local)}`,
    `Origem: ${p.origem.join(', ')}`,
    p.mensagem,
    `Sugestão: ${p.sugestao}`,
    '',
    );
  }
  if (diagnosticos.length > 0) {
    linhas.push('Regras não verificadas nesta análise:');
    for (const d of diagnosticos) linhas.push(`- ${d.mensagem}`);
    linhas.push('');
  }
  // R-M6-06: cada item é uma linha só. Título, trecho ou mensagem com quebra não forjam linhas ("Resultado: 0 erro(s)")
  // no relatório que o autor entrega a outra pessoa.
  // R-M7-02: todo controle C0/C1 (inclusive NEL, U+0085) e os de direção bidi.
  return linhas.map((l) => l.replace(/[\p{Cc}\u2028\u2029\u202A-\u202E\u2066-\u2069]+/gu, ' ')).join('\n');
}
