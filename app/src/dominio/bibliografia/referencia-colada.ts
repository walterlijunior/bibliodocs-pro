/**
 * Referência colada (Etapa 5 da especificação de atualização, D-E5-06): o texto que portais como SciELO, Google
 * Acadêmico, periódicos, repositórios e anais oferecem pronto, no padrão ABNT, convertido em campos da obra.
 *
 * A conversão é uma sugestão: nada aqui é gravado sem a prévia. O texto colado fica guardado como veio
 * (`referenciaLivre`), e o que a leitura não conseguiu ou adivinhou vai para `incertos` e `faltando`, para a tela
 * marcar. Reconhece as formas mais comuns:
 * - autoria: "SOBRENOME, Prenome; SOBRENOME, Prenome" ou "et al.", ou entidade em maiúsculas ("UNIVERSIDADE …");
 * - artigo de periódico: "Título. Periódico, Local, v. 10, n. 2, p. 15-30, 2020.";
 * - capítulo: "Título. In: …";
 * - trabalho acadêmico: "Dissertação (…)", "Tese (…)", "Trabalho de Conclusão de Curso (…)";
 * - livro e demais: "Título. 2. ed. Local: Editora, ano.";
 * - "DOI: …", "Disponível em: URL", "Acesso em: 3 mar. 2024".
 * Função pura, sem expressão que dependa de rede ou de arquivo.
 */
import type { Autor, InlineDeTitulo, Obra, TipoObra } from '../modelo';

export interface ReferenciaLida {
  tipo: TipoObra;
  /** Campos sugeridos (sem id); vazio = não achado. */
  campos: Partial<Omit<Obra, 'id' | 'tipo'>>;
  /** Campos adivinhados (a tela os marca para conferir), com o motivo. */
  incertos: { campo: string; motivo: string }[];
  /** Campos essenciais que o texto não tem. */
  faltando: string[];
}

const MESES: Record<string, number> = { jan: 1, fev: 2, mar: 3, abr: 4, maio: 5, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
const t = (texto: string): InlineDeTitulo[] => (texto.trim() === '' ? [] : [{ tipo: 'texto', texto: texto.trim() }]);

/** "3 mar. 2024" → "2024-03-03"; inválida = null. */
export function dataDeAcesso(texto: string): string | null {
  const m = /(\d{1,2})\s+([a-zç]{3,4})\.?\s+(\d{4})/i.exec(texto);
  if (!m) return null;
  const chave = m[2]!.toLowerCase();
  const mes = MESES[chave] ?? MESES[chave.slice(0, 3)];
  if (!mes) return null;
  const dia = Number(m[1]);
  if (dia < 1 || dia > 31) return null;
  return `${m[3]}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Divide no ". " que fecha um elemento, sem cortar abreviações de uma letra ("J.", "v.", "n.", "p.", "ed."). */
function elementos(texto: string): string[] {
  const partes: string[] = [];
  let atual = '';
  const palavras = texto.split(/(\s+)/);
  for (let i = 0; i < palavras.length; i++) {
    const w = palavras[i]!;
    atual += w;
    const fim = /\.$/.test(w) && !/^(\p{Lu}|v|n|p|ed|org|coord|comp|al|Supl|trim|jan|fev|mar|abr|jun|jul|ago|set|out|nov|dez|S|s|l|Ed|Org)\.$/u.test(w) && !/^\p{Lu}\.(\p{Lu}\.)*$/u.test(w);
    if (fim) {
      partes.push(atual.trim());
      atual = '';
    }
  }
  if (atual.trim() !== '') partes.push(atual.trim());
  return partes.map((p) => p.replace(/\.$/, '').trim()).filter((p) => p !== '');
}

function autoria(seg: string): Autor[] | null {
  const s = seg.replace(/\s+et al\.?$/i, '').trim();
  const pessoas = s.split(/\s*;\s*/);
  const lidos: Autor[] = [];
  for (const p of pessoas) {
    const m = /^([\p{Lu}][\p{Lu}'’\- ]+),\s*(.+)$/u.exec(p.trim());
    if (!m) return null;
    lidos.push({ tipo: 'pessoa', sobrenome: m[1]!.trim(), prenomes: m[2]!.trim() });
  }
  return lidos;
}

const ehEntidade = (seg: string): boolean => /^[\p{Lu}0-9][\p{Lu}0-9 .,'’()\-–]+$/u.test(seg) && seg.replace(/[^\p{Lu}]/gu, '').length >= 3 && !seg.includes(',');

export function lerReferenciaColada(original: string): ReferenciaLida {
  let texto = original.replace(/\s+/g, ' ').trim();
  const campos: ReferenciaLida['campos'] = {};
  const incertos: ReferenciaLida['incertos'] = [];

  // Endereço, acesso e DOI saem primeiro (têm pontos dentro).
  const disp = /Dispon[ií]vel em:\s*<?(https?:\/\/\S+?)>?\.?(?=\s|$)/i.exec(texto);
  if (disp) {
    campos.url = disp[1]!.replace(/[.,;]$/, '');
    texto = texto.replace(disp[0], ' ');
  }
  const acesso = /Acesso em:\s*([^.]+\.?\s*\d{4})\.?/i.exec(texto);
  if (acesso) {
    const d = dataDeAcesso(acesso[1]!);
    if (d) campos.acesso = d;
    else incertos.push({ campo: 'acesso', motivo: `Data de acesso não lida: “${acesso[1]!.trim()}”.` });
    texto = texto.replace(acesso[0], ' ');
  }
  const doi = /DOI:\s*(\S+?)\.?(?=\s|$)/i.exec(texto) ?? /https?:\/\/(?:dx\.)?doi\.org\/(\S+?)\.?(?=\s|$)/i.exec(texto);
  if (doi) {
    campos.doi = doi[1]!.replace(/[.,;]$/, '');
    texto = texto.replace(doi[0], ' ');
  }
  if (!campos.url) {
    const solto = /(https?:\/\/\S+?)\.?(?=\s|$)/.exec(texto);
    if (solto) {
      campos.url = solto[1]!;
      texto = texto.replace(solto[0], ' ');
      incertos.push({ campo: 'url', motivo: 'Endereço sem “Disponível em:”: confira se é o da obra.' });
    }
  }
  texto = texto.replace(/\s+/g, ' ').trim();

  // Autoria pessoal com iniciais ("SILVA, J. A.; SOUZA, M. Título"): o segmento vai até o ponto que não é de inicial
  // seguida de outra inicial.
  let partes: string[];
  if (/^[\p{Lu}][\p{Lu}'’\- ]+,/u.test(texto)) {
    const palavras = texto.split(' ');
    let fim = -1;
    for (let k = 0; k < palavras.length && fim < 0; k++) {
      const w = palavras[k]!;
      if (!w.endsWith('.')) continue;
      const inicial = /^\p{Lu}\.$/u.test(w);
      const proxima = palavras[k + 1] ?? '';
      // Depois da inicial, outra inicial ou a partícula ("S. de.") continuam o nome.
      if (!inicial || !/^(\p{Lu}\.;?|(de|da|do|dos|das|e)\.?;?)$/u.test(proxima)) fim = k;
    }
    // O ponto final da autoria sai, menos o da inicial ("V. C.").
    const segmento = fim < 0 ? '' : palavras.slice(0, fim + 1).join(' ');
    partes = fim < 0 ? elementos(texto) : [/\s\p{Lu}\.$/u.test(segmento) ? segmento : segmento.replace(/\.$/, ''), ...elementos(palavras.slice(fim + 1).join(' '))];
  } else {
    // Entidade em maiúsculas ("CAMIL ALIMENTOS S.A.", "COMISSÃO DE VALORES MOBILIÁRIOS (CVM)") antes do título.
    const ent = /^([\p{Lu}0-9][\p{Lu}0-9&'’\-–.]*(?:\s+(?:[\p{Lu}0-9][\p{Lu}0-9&'’\-–.]*|\([\p{Lu}0-9]+\)))*)\.\s+(?=[\p{Lu}\d])/u.exec(texto);
    partes = ent ? [ent[1]!, ...elementos(texto.slice(ent[0].length))] : elementos(texto);
  }
  let i = 0;
  const pessoas = partes[0] ? autoria(partes[0]) : null;
  if (pessoas && pessoas.length > 0) {
    campos.autores = pessoas;
    i = 1;
  } else if (partes[0] && ehEntidade(partes[0]) && partes.length > 2) {
    campos.autores = [{ tipo: 'entidade', nome: partes[0].trim() }];
    incertos.push({ campo: 'autores', motivo: 'Autoria lida como entidade (nome em maiúsculas): confira.' });
    i = 1;
  }

  const tituloInteiro = partes[i] ?? '';
  const [titulo, ...sub] = tituloInteiro.split(/:\s+/);
  campos.titulo = t(titulo ?? '');
  if (sub.length > 0) campos.subtitulo = t(sub.join(': '));
  const resto = partes.slice(i + 1).join('. ');

  const anos = [...resto.matchAll(/(?<!\d)(1[5-9]\d{2}|20\d{2})(?!\d)/g)].map((m) => Number(m[1]));
  if (anos.length > 0) campos.ano = anos.at(-1)!;

  let tipo: TipoObra;
  const periodico = /^([^,]+?),\s*(?:([^,]*?),\s*)?(?:v\.\s*([^,]+),\s*)?(?:n\.\s*([^,]+),\s*)?(?:p\.\s*([\d\-–]+),\s*)?.*?(\d{4})/.exec(resto);
  const trabalho = /(Disserta[çc][ãa]o|Tese|Trabalho de Conclus[ãa]o de Curso|Monografia)\s*\(([^)]*)\)/i.exec(resto);
  if (/^In:\s/i.test(resto)) {
    tipo = 'capitulo';
    incertos.push({ campo: 'noTodo', motivo: 'Capítulo: confira o título e os autores do livro no todo.' });
    const todo = /^In:\s*(.*?)(?:\.\s|$)/i.exec(resto);
    if (todo) campos.noTodo = { titulo: t(todo[1]!.replace(/^[^.]*\(org\.\)\s*/i, '')) };
    const imp = /([^.:]+):\s*([^,]+),\s*\d{4}/.exec(resto);
    if (imp) {
      campos.local = imp[1]!.trim();
      campos.editora = imp[2]!.trim();
    }
    const pag = /p\.\s*([\d\-–]+)/.exec(resto);
    if (pag) campos.paginas = pag[1]!.replace('–', '-');
  } else if (trabalho) {
    tipo = 'trabalhoAcademico';
    campos.natureza = `${trabalho[1]} (${trabalho[2]})`;
    const inst = new RegExp(`${trabalho[2]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\s*[–-]\\s*([^,]+)`).exec(resto);
    if (inst) campos.instituicao = inst[1]!.trim();
    else incertos.push({ campo: 'instituicao', motivo: 'Instituição não achada depois da natureza.' });
  } else if (periodico && /\b(v|n)\.\s/.test(resto)) {
    tipo = 'artigoPeriodico';
    campos.periodico = periodico[1]!.trim();
    if (periodico[2] && !/^(v|n|p)\.\s/.test(periodico[2])) campos.local = periodico[2].trim();
    if (periodico[3]) campos.volume = periodico[3].trim();
    if (periodico[4]) campos.numero = periodico[4].trim();
    if (periodico[5]) campos.paginas = periodico[5].replace('–', '-');
  } else {
    const imp = /([^.:,]+):\s*([^,]+),\s*\[?\d{4}/.exec(resto);
    const nome = tituloInteiro.toLowerCase();
    if (nome.includes('base de dados')) tipo = 'baseDados';
    else if (/demonstra[çc][õo]es financeiras|demonstrativos? financeiros?|formul[áa]rio de refer[êe]ncia/.test(nome)) tipo = 'demonstracaoFinanceira';
    else if (/relat[óo]rio/.test(nome)) tipo = 'relatorio';
    else if (/^(resolu[çc][ãa]o|lei|decreto|portaria|instru[çc][ãa]o normativa|medida provis[óo]ria)\b/.test(nome)) tipo = 'legislacao';
    else tipo = campos.url && !imp ? 'documentoOnline' : 'livro';
    if (tipo === 'legislacao') {
      // Na legislação, a ementa vem logo depois do título.
      const ementa = partes[i + 1];
      if (ementa && !/:\s*[^,]+,\s*\d{4}/.test(ementa)) campos.ementa = ementa;
    }
    if (imp) {
      campos.local = imp[1]!.trim();
      campos.editora = imp[2]!.trim();
    }
    const ed = /(\d+)\.\s*ed\./.exec(resto);
    if (ed) campos.edicao = Number(ed[1]);
    const pags = /(\d+)\s*p\.(?:\s|$)/.exec(resto);
    if (pags) campos.paginas = pags[1]!;
    incertos.push({
      campo: 'tipo',
      motivo: tipo === 'livro' ? 'Sem periódico nem “In:”: lido como livro. Confira o tipo.' : tipo === 'documentoOnline' ? 'Só endereço e data: lido como página web.' : 'Tipo deduzido do título: confira.',
    });
  }
  if (tipo === 'capitulo' || tipo === 'trabalhoAcademico' || tipo === 'artigoPeriodico') incertos.push({ campo: 'tipo', motivo: 'Tipo deduzido do texto: confira.' });

  const faltando: string[] = [];
  if ((campos.titulo ?? []).length === 0) faltando.push('título');
  if (campos.ano === undefined) faltando.push('ano');
  if (!campos.autores) incertos.push({ campo: 'autores', motivo: 'Autoria não reconhecida: a obra entra pelo título. Confira.' });
  if (campos.url && !campos.acesso) faltando.push('data de acesso');
  return { tipo, campos, incertos, faltando };
}
