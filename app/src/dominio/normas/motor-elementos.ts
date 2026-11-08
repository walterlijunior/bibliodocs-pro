/**
 * Pré e pós-textuais no motor (M3-T04; RN-117 a RN-158, RN-231 a RN-237). Só estrutura e texto: a forma vem dos estilos,
 * que vêm do perfil. Os títulos fixos transcrevem o Manual. As listas (ilustrações, tabelas, siglas, símbolos) vêm dos
 * geradores do M6 (`motor-listas.ts`, `motor-catalogos.ts`).
 *
 * Campo vazio não gera parágrafo: a falta já é pendência na aba Escrever (RF-04).
 */
import { letraPosTextual, letraSemFonte } from '../numeracao';
import type { ElementoPosTextual, ElementoPreTextual, IdiomaResumo, InlineDeTitulo, MembroBanca, Metadados, PessoaTitulada } from '../modelo';
import type { AvisoFormatacao, BlocoFormatado, TrechoFormatado } from './formatado';

/** Títulos da RN-158. Só "Keywords" tem fonte (Fig. 11); espanhol e francês vêm do perfil (RN-315, D-M3-12). */
const TITULOS_RESUMO: Readonly<Record<IdiomaResumo, string>> = { en: 'ABSTRACT', es: 'RESUMEN', fr: 'RÉSUMÉ' };
const IDIOMA_LEGIVEL: Readonly<Record<'es' | 'fr', string>> = { es: 'espanhol', fr: 'francês' };

/** Rótulos provisórios das palavras-chave em espanhol e francês; `null` sem a regra ou sem o valor. */
export interface RotulosPalavrasChave {
  rn: string | null;
  es: string | null;
  fr: string | null;
}
const SEPARADOR = ' – '; // C-A5, RN-053

const trecho = (texto: string): TrechoFormatado => ({ tipo: 'texto', texto, marcas: [] });
const paragrafo = (estilo: string, trechos: readonly TrechoFormatado[], origem: readonly string[], extra: { novaPagina?: true; antesTw?: number } = {}): BlocoFormatado => ({
  tipo: 'paragrafo',
  estilo,
  trechos,
  origem,
  ...extra,
});
const deTexto = (estilo: string, texto: string | undefined, origem: readonly string[]): BlocoFormatado[] =>
  texto === undefined || texto.trim() === '' ? [] : [paragrafo(estilo, [trecho(texto)], origem)];
/** `\n` separa parágrafos nos campos de texto simples. */
const paragrafosDe = (estilo: string, texto: string | undefined, origem: readonly string[]): BlocoFormatado[] =>
  (texto ?? '').split('\n').filter((l) => l.trim() !== '').map((l) => paragrafo(estilo, [trecho(l)], origem));

const deTitulo = (i: readonly InlineDeTitulo[]): TrechoFormatado[] => i.map((t) => ({ tipo: 'texto', texto: t.texto, marcas: t.marcas ?? [] }));
/** Título e subtítulo no mesmo parágrafo, separados por quebra de linha, para a capa e a folha de rosto distribuírem bem. */
function tituloCompleto(m: Metadados): TrechoFormatado[] {
  const sub = m.subtitulo ?? [];
  const partes = deTitulo(m.titulo);
  if (sub.length === 0) return partes;
  if (partes.length === 0) return deTitulo(sub);
  return [...partes, trecho('\n'), ...deTitulo(sub)];
}
const linhas = (...valores: (string | undefined)[]): TrechoFormatado[] => {
  const v = valores.filter((x): x is string => x !== undefined && x.trim() !== '');
  return v.length === 0 ? [] : [trecho(v.join('\n'))];
};
const quando = (estilo: string, t: readonly TrechoFormatado[], origem: readonly string[]): BlocoFormatado[] => (t.length === 0 ? [] : [paragrafo(estilo, t, origem)]);

export function blocosCapa(m: Metadados): BlocoFormatado[] {
  return [
    ...quando('capaInstituicao', linhas(m.instituicao, m.campus, m.curso), ['RN-117', 'RN-119']),
    ...quando('capaAutoria', linhas(m.autoria), ['RN-117', 'RN-120']),
    ...quando('capaTitulo', [...tituloCompleto(m), ...(m.volume ? [trecho('\n'), trecho(m.volume)] : [])], ['RN-117', 'RN-121', 'RN-122']),
    ...quando('capaLocalAno', linhas(m.local, m.ano), ['RN-117', 'RN-123']),
  ];
}

const pessoa = (rotulo: string, p: PessoaTitulada | undefined): string | undefined => {
  if (!p?.nome && !p?.titulacao) return undefined;
  return `${rotulo}: ${[p.titulacao, p.nome].filter(Boolean).join('/')}`;
};
function natureza(m: Metadados, estilo: string, origem: readonly string[]): BlocoFormatado[] {
  return [...deTexto(estilo, m.natureza, origem), ...deTexto(estilo, m.areaConcentracao ? `Área de concentração: ${m.areaConcentracao}` : undefined, origem)];
}

export function blocosFolhaRosto(m: Metadados): BlocoFormatado[] {
  return [
    ...quando('rostoAutoria', linhas(m.autoria), ['RN-127', 'RN-128', 'RN-130']),
    ...quando('rostoTitulo', tituloCompleto(m), ['RN-127', 'RN-129', 'RN-130']),
    // Um parágrafo só: a distribuição vertical da folha separaria a natureza do orientador (Figura 5).
    ...quando(
      'naturezaTrabalho',
      linhas(m.natureza, m.areaConcentracao ? `Área de concentração: ${m.areaConcentracao}` : undefined, pessoa('Orientador (a)', m.orientador), pessoa('Coorientador (a)', m.coorientador)),
      ['RN-127', 'RN-131', 'RN-132'],
    ),
    ...quando('rostoLocalAno', linhas(m.local, m.ano), ['RN-127', 'RN-134']),
  ];
}

function membro(b: MembroBanca): string {
  const nome = [b.titulacao, b.nome].filter(Boolean).join(' ');
  return [nome, b.instituicao].filter(Boolean).join(', ');
}

/** Elemento pré-textual fora de capa, folha de rosto e ficha, que têm seção própria. */
export function blocosPreTextual(
  e: ElementoPreTextual,
  m: Metadados,
  opcoes: { meioDaAreaUtilTw: number | null; avisos: AvisoFormatacao[]; entradas: () => BlocoFormatado; rotulosPalavrasChave: RotulosPalavrasChave; listas: (e: Extract<ElementoPreTextual, { tipo: 'listaIlustracoes' | 'listaTabelas' }>) => BlocoFormatado[]; siglas: () => BlocoFormatado[]; simbolos: () => BlocoFormatado[] },
): BlocoFormatado[] {
  const titulo = (texto: string, origem: readonly string[]) => paragrafo('tituloSemIndicativo', [trecho(texto)], origem, { novaPagina: true });
  switch (e.tipo) {
    case 'errata':
      return [titulo('ERRATA', ['RN-007', 'RN-045', 'RN-139']), ...paragrafosDe('corpo', e.texto, ['RN-139'])];
    case 'folhaAprovacao': {
      const banca = (e.banca ?? []).filter((b) => membro(b) !== '');
      const blocos: BlocoFormatado[] = [
        ...quando('aprovacaoIdentificacao', linhas(m.autoria), ['RN-140', 'RN-141']),
        ...quando('aprovacaoIdentificacao', tituloCompleto(m), ['RN-140', 'RN-141']),
        ...natureza(m, 'aprovacaoNatureza', ['RN-140', 'RN-142']),
        ...deTexto('aprovacaoData', e.dataAprovacao ? `Data de aprovação: ${e.dataAprovacao}` : 'Data de aprovação: ____/____/_____', ['RN-143']),
        paragrafo('aprovacaoData', [trecho('Banca examinadora')], ['RN-140']),
        ...banca.flatMap((b) => [paragrafo('aprovacaoBanca', [trecho('_'.repeat(40))], ['RN-144']), paragrafo('aprovacaoBanca', [trecho(membro(b))], ['RN-144'])]),
      ];
      return primeiraEmNovaPagina(blocos);
    }
    case 'dedicatoria': {
      const blocos = paragrafosDe('dedicatoria', e.texto, ['RN-145', 'RN-146']);
      if (blocos.length === 0) return [];
      // "Inicia abaixo do meio da folha" (RN-146): a primeira linha desce metade da área útil.
      const [primeiro, ...resto] = blocos as [Extract<BlocoFormatado, { tipo: 'paragrafo' }>, ...BlocoFormatado[]];
      return [{ ...primeiro, novaPagina: true, ...(opcoes.meioDaAreaUtilTw !== null ? { antesTw: opcoes.meioDaAreaUtilTw } : {}) }, ...resto];
    }
    case 'agradecimentos':
      return [titulo('AGRADECIMENTOS', ['RN-007', 'RN-045', 'RN-148']), ...paragrafosDe('agradecimentos', e.texto, ['RN-036', 'RN-148'])];
    case 'epigrafe': {
      const blocos = paragrafosDe('corpo', e.texto, ['RN-149']);
      if (blocos.length === 0) return [];
      // RN-037 está PENDENTE-FONTE: o texto sai como corpo, e o autor é avisado de que falta a forma.
      opcoes.avisos.push({ codigo: 'FORMA_SEM_FONTE', id: e.id, mensagem: 'A forma da epígrafe depende da NBR 10520 (RN-037): saiu como texto comum.' });
      return primeiraEmNovaPagina(blocos);
    }
    case 'resumo':
      return resumo('RESUMO', 'Palavras-chave', e.texto, e.palavrasChave, ['RN-007', 'RN-045', 'RN-151'], ['RN-150', 'RN-152', 'RN-153']);
    case 'abstract': {
      const idioma = e.idioma ?? 'en';
      if (idioma === 'en') return resumo(TITULOS_RESUMO.en, 'Keywords', e.texto, e.palavrasChave, ['RN-007', 'RN-045', 'RN-158'], ['RN-157', 'RN-152', 'RN-153']);
      const rotulo = opcoes.rotulosPalavrasChave[idioma];
      const { rn } = opcoes.rotulosPalavrasChave;
      if ((e.palavrasChave ?? []).length > 0) {
        opcoes.avisos.push(
          rotulo === null || rn === null
            ? { codigo: 'FORMA_SEM_FONTE', id: e.id, mensagem: `O Manual não diz o rótulo das palavras-chave em ${IDIOMA_LEGIVEL[idioma]}: saiu "Keywords".` }
            : { codigo: 'ROTULO_PROVISORIO', id: e.id, mensagem: `O rótulo "${rotulo}:" é provisório: o Manual só mostra "Keywords:" (${rn}).` },
        );
      }
      const origem = rotulo !== null && rn !== null ? ['RN-157', 'RN-152', 'RN-153', rn] : ['RN-157', 'RN-152', 'RN-153'];
      return resumo(TITULOS_RESUMO[idioma], rotulo ?? 'Keywords', e.texto, e.palavrasChave, ['RN-007', 'RN-045', 'RN-158'], origem);
    }
    case 'sumario':
      return [titulo('SUMÁRIO', ['RN-007', 'RN-045', 'RN-171']), opcoes.entradas()];
    case 'listaIlustracoes':
    case 'listaTabelas':
      return opcoes.listas(e);
    case 'listaSiglas':
      return opcoes.siglas();
    case 'listaSimbolos':
      return opcoes.simbolos();
    case 'capa':
    case 'folhaRosto':
    case 'fichaCatalografica':
      return [];
  }
}

const primeiraEmNovaPagina = (blocos: BlocoFormatado[]): BlocoFormatado[] =>
  blocos.map((b, i) => (i === 0 && b.tipo === 'paragrafo' ? { ...b, novaPagina: true as const } : b));

function resumo(titulo: string, rotulo: string, texto: string | undefined, palavras: readonly string[] | undefined, origemTitulo: readonly string[], origem: readonly string[]): BlocoFormatado[] {
  const pc = (palavras ?? []).map((p) => p.trim().replace(/\.+$/, '')).filter((p) => p !== '');
  return [
    paragrafo('tituloSemIndicativo', [trecho(titulo)], origemTitulo, { novaPagina: true }),
    ...paragrafosDe('resumo', texto, origem),
    // Separadas e finalizadas por ponto (RN-156).
    ...(pc.length === 0 ? [] : [paragrafo('resumo', [trecho(`${rotulo}: ${pc.join('. ')}.`)], ['RN-156'])]),
  ];
}

/** `referencias` gera a lista ordenada (M4-T05); chamado só se o trabalho tem o elemento. */
export function blocosPosTextuais(lista: readonly ElementoPosTextual[], avisos: AvisoFormatacao[], referencias: () => BlocoFormatado[] = () => [], glossario: () => BlocoFormatado[] = () => [], conteudo: (e: Extract<ElementoPosTextual, { tipo: 'apendice' | 'anexo' }>) => BlocoFormatado[] = () => []): BlocoFormatado[] {
  const blocos: BlocoFormatado[] = [];
  const titulo = (texto: string, origem: readonly string[]) => blocos.push(paragrafo('tituloPosTextual', [trecho(texto)], origem, { novaPagina: true }));
  const contar = (tipo: 'apendice' | 'anexo') => lista.filter((e) => e.tipo === tipo).length;
  const vistos = { apendice: 0, anexo: 0 };
  for (const e of lista) {
    switch (e.tipo) {
      case 'referencias':
        titulo('REFERÊNCIAS', ['RN-007', 'RN-045']);
        blocos.push(...referencias());
        break;
      case 'glossario':
        titulo('GLOSSÁRIO', ['RN-007', 'RN-045', 'RN-230']);
        blocos.push(...glossario());
        break;
      case 'indice':
        titulo('ÍNDICE', ['RN-007', 'RN-045', 'RN-238']);
        break;
      case 'apendice':
      case 'anexo': {
        const apendice = e.tipo === 'apendice';
        const i = vistos[e.tipo]++;
        const palavra = apendice ? 'APÊNDICE' : 'ANEXO';
        const rn = apendice ? ['RN-231', 'RN-232', 'RN-237'] : ['RN-234', 'RN-235', 'RN-237'];
        // C-B17: título geral centralizado uma só vez, e cada identificação à esquerda.
        if (i === 0) titulo(contar(e.tipo) > 1 ? (apendice ? 'APÊNDICES' : 'ANEXOS') : palavra, ['RN-237']);
        const letra = letraPosTextual(i);
        if (letraSemFonte(i)) avisos.push({ codigo: 'LETRA_SEM_FONTE', id: e.id, mensagem: `A letra ${letra} passa de ZZ: o Manual não define essa forma.` });
        const nome = e.titulo?.trim();
        // N-M6-01: o Manual pede letra, travessão e título (p. 65, cap. 7; p. 66, cap. 8).
        if (!nome) avisos.push({ codigo: 'POS_TEXTUAL_SEM_TITULO', id: e.id, mensagem: `${palavra} ${letra} está sem título: o Manual pede "${palavra} ${letra} – Título" (${apendice ? 'RN-231' : 'RN-234'}).` });
        // Marcador curto: o Word aceita até 40 caracteres, só letras, algarismos e "_" (o id pode ter "-" e 64).
        // D-M6-12 (revisão do M6, N-M6-08): com conteúdo, cada apêndice ou anexo depois do primeiro começa em folha nova,
        // para o conteúdo de um não emendar na identificação do seguinte.
        const novaFolha = i > 0 && (e.blocos ?? []).length > 0 ? { novaPagina: true as const } : {};
        blocos.push({ ...paragrafo('identificacaoPosTextual', [trecho(`${palavra} ${letra}${nome ? `${SEPARADOR}${nome}` : ''}`)], rn), ancora: `_Pos_${apendice ? 'A' : 'N'}${i + 1}`, ...novaFolha } as BlocoFormatado);
        blocos.push(...conteudo(e));
        break;
      }
    }
  }
  return blocos;
}
