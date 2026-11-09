/**
 * Verificações do texto (M7-T01). Só diagnostica; nunca muda o documento. Tudo aviso (D-M7-03): são heurísticas sobre o
 * que o autor digitou, e o motor já gera a forma certa do que é dele (indicativo, caixa do título primário).
 *
 * - TITULO_CAIXA_ALTA (RN-043; Manual p. 17, Quadro 1): título secundário a quinário escrito todo em maiúsculas. Só com
 *   uma palavra de quatro letras ou mais, para não acusar título que é só sigla ("2.1 UFT").
 * - TITULO_COM_INDICATIVO (RN-109; Manual p. 15, seção 2.3): título que começa com um número no formato de indicativo
 *   ("1 ", "2.1 ", "3. "). O app numera sozinho; o número digitado sairia em dobro. Ano ("2020 em…") não conta.
 * - SUPRESSAO_FORA_DO_PADRAO (RN-086; Manual p. 23, seção 3.1): "(...)", "(…)", "..." ou "…" fora de colchetes dentro
 *   de citação: na citação longa e no trecho entre aspas duplas do texto corrido (RN-081).
 * - TITULO_VAZIO e SECAO_SEM_TEXTO (D-M7-02, critério provisório): título só com espaços; seção do corpo sem blocos e
 *   sem subseções. Apêndice e anexo sem conteúdo são permitidos (D-M6-12) e ficam de fora.
 */
import { conteudosDoBloco, secoesDeLeitura, type Documento, type Id, type Inline, type Secao } from '../modelo';

export type CodigoProblemaTexto =
  | 'TITULO_CAIXA_ALTA'
  | 'TITULO_COM_INDICATIVO'
  | 'SUPRESSAO_FORA_DO_PADRAO'
  | 'TITULO_VAZIO'
  | 'SECAO_SEM_TEXTO';

export interface ProblemaTexto {
  codigo: CodigoProblemaTexto;
  origem: readonly string[];
  mensagem: string;
  secao: Id;
  no: Id;
  trecho?: string;
}

/** Limite técnico, como nas siglas: o relatório avisa quando é atingido. */
export const MAXIMO_PROBLEMAS_TEXTO = 1000;

const textoDoTitulo = (s: Secao): string => s.titulo.map((t) => (t.tipo === 'texto' ? t.texto : '')).join('').replace(/\s+/gu, ' ').trim();
const INDICATIVO_DIGITADO = /^\d{1,2}(?:\.\d{1,2}){0,4}\.?(?=\s|$)/u;
const SUPRESSAO = /\[\s*(?:\.\.\.|…)\s*\]|\(\s*(?:\.\.\.|…)\s*\)|\.\.\.|…/gu;
const ASPAS = /[“"]([^“”"]{1,5000})[”"]/gu;

function emCaixaAlta(t: string): boolean {
  if (/\p{Ll}/u.test(t)) return false;
  return (t.match(/\p{Lu}{4,}/gu) ?? []).length > 0;
}

/** Supressões fora de colchetes no trecho; devolve as formas achadas, sem repetir. */
function supressoes(trecho: string): string[] {
  const achadas = new Set<string>();
  for (const m of trecho.matchAll(SUPRESSAO)) if (!m[0].startsWith('[')) achadas.add(m[0]);
  return [...achadas];
}

function textoCorrido(conteudo: readonly Inline[]): string {
  return conteudo.map((i) => (i.tipo === 'texto' ? i.texto : ' ')).join('');
}

export function verificarTexto(doc: Pick<Documento, 'corpo'> & Partial<Pick<Documento, 'posTextuais'>>): ProblemaTexto[] {
  const saida: ProblemaTexto[] = [];
  const cheio = () => saida.length >= MAXIMO_PROBLEMAS_TEXTO;

  const titulos = (s: Secao, nivel: number) => {
    const t = textoDoTitulo(s);
    if (t === '') {
      saida.push({ codigo: 'TITULO_VAZIO', origem: ['D-M7-02'], mensagem: 'A seção está sem título; o sumário e a numeração ficam sem texto.', secao: s.id, no: s.id });
    } else {
      const ind = INDICATIVO_DIGITADO.exec(t);
      if (ind) saida.push({ codigo: 'TITULO_COM_INDICATIVO', origem: ['RN-109'], mensagem: `O título começa com “${ind[0]}”, que parece um indicativo digitado; o aplicativo numera as seções sozinho e o número sairia em dobro.`, secao: s.id, no: s.id, trecho: ind[0] });
      if (nivel >= 2 && emCaixaAlta(t)) saida.push({ codigo: 'TITULO_CAIXA_ALTA', origem: ['RN-043'], mensagem: 'Título de seção secundária a quinária escrito todo em maiúsculas; o Manual pede só a inicial maiúscula (e os nomes próprios).', secao: s.id, no: s.id, trecho: t.slice(0, 80) });
    }
    if (s.blocos.length === 0 && s.subsecoes.length === 0) saida.push({ codigo: 'SECAO_SEM_TEXTO', origem: ['D-M7-02'], mensagem: 'A seção não tem texto nem subseções.', secao: s.id, no: s.id });
    for (const sub of s.subsecoes) { if (cheio()) return; titulos(sub, nivel + 1); }
  };
  for (const s of doc.corpo) { if (cheio()) break; titulos(s, 1); }

  const citacoes = (s: Secao) => {
    for (const b of s.blocos) {
      if (cheio()) return;
      const trechos = b.tipo === 'citacaoLonga'
        ? [textoCorrido(b.conteudo)]
        : conteudosDoBloco(b).flatMap((c) => [...textoCorrido(c).matchAll(ASPAS)].map((m) => m[1]!));
      const formas = new Set(trechos.flatMap(supressoes));
      if (formas.size > 0) {
        const lista = [...formas].map((f) => `“${f}”`).join(', ');
        saida.push({ codigo: 'SUPRESSAO_FORA_DO_PADRAO', origem: ['RN-086'], mensagem: `Supressão indicada por ${lista} dentro de citação; o Manual indica supressões por [...].`, secao: s.id, no: b.id, trecho: [...formas][0]! });
      }
    }
    for (const sub of s.subsecoes) citacoes(sub);
  };
  for (const s of secoesDeLeitura(doc)) { if (cheio()) break; citacoes(s); }
  return saida.slice(0, MAXIMO_PROBLEMAS_TEXTO);
}
