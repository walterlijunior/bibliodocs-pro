/** Diagnóstico conservador (M6-T03, RN-046/047): só sugere; nunca liga texto automaticamente. */
import { chaveDeSigla, conteudosDoBloco, ocorrenciasDeSiglas, secoesDeLeitura, type Documento, type Inline, type Secao } from '../modelo';

export interface ProblemaSigla {
  codigo: 'SIGLA_SEM_CADASTRO' | 'SIGLA_SEM_LIGACAO' | 'SIGLA_QUEBRADA' | 'SIGLA_EXTENSO_REPETIDO';
  secao: string;
  no: string;
  trecho: string;
  sigla?: string;
  mensagem: string;
  rn: readonly string[];
}

export const MAXIMO_PROBLEMAS_SIGLAS = 1000;

const PALAVRA = /[\p{L}\p{N}]+/gu;
interface ApresentadaSigla { sigla: string; extenso: string }
/** Nó da árvore de palavras das formas por extenso já apresentadas (RN-047). */
interface NoExtenso { filhos: Map<string, NoExtenso>; fim?: ApresentadaSigla }

export function conferirSiglas(doc: Pick<Documento, 'corpo'> & Partial<Pick<Documento, 'siglas' | 'posTextuais'>>): ProblemaSigla[] {
  const saida: ProblemaSigla[] = [];
  const MAXIMO = MAXIMO_PROBLEMAS_SIGLAS;
  const cadastro = new Map((doc.siglas ?? []).map((s) => [chaveDeSigla(s.sigla), s]));
  const ids = new Set((doc.siglas ?? []).map((s) => s.id));
  const porId = new Map((doc.siglas ?? []).map((s) => [s.id, s]));
  // RN-047 (2.ª parte, M6-T07): depois da primeira ocorrência ligada, a forma por extenso de novo vira aviso.
  const apresentadas = new Set<string>();
  const raizExtensos: NoExtenso = { filhos: new Map() };
  for (const o of ocorrenciasDeSiglas(doc)) {
    if (!ids.has(o.inline.sigla)) saida.push({ codigo: 'SIGLA_QUEBRADA', secao: o.secao, no: o.no, trecho: '[sigla sem cadastro]', sigla: o.inline.sigla, mensagem: 'A sigla ligada no texto não está mais no cadastro.', rn: ['RN-046'] });
    if (saida.length >= MAXIMO) return saida;
  }
  const verificar = (texto: string, secao: string, noId: string) => {
    // R-M6-05/07: árvore de palavras com as formas já apresentadas. O texto é lido palavra por palavra e cada posição
    // desce a árvore só enquanto as palavras coincidem: custo linear no texto, e o limite de palavra vem de graça (não
    // acha "Unidade" dentro de "comunidade"). Pontuação entre as palavras é ignorada.
    if (raizExtensos.filhos.size > 0) {
      const palavras = [...texto.toLocaleLowerCase('pt-BR').matchAll(PALAVRA)].map((m) => m[0]);
      const vistos = new Set<ApresentadaSigla>();
      for (let i = 0; i < palavras.length; i++) {
        let no: NoExtenso | undefined = raizExtensos;
        for (let k = i; k < palavras.length && no; k++) {
          no = no.filhos.get(palavras[k]!);
          const a = no?.fim;
          if (!a || vistos.has(a)) continue;
          vistos.add(a);
          saida.push({ codigo: 'SIGLA_EXTENSO_REPETIDO', secao, no: noId, trecho: a.extenso, mensagem: `“${a.extenso}” já foi apresentado com a sigla ${a.sigla}; nas ocorrências seguintes, use só a sigla.`, rn: ['RN-047'] });
          if (saida.length >= MAXIMO) return;
        }
      }
    }
    for (const m of texto.matchAll(/(?<![\p{L}\p{N}])\p{Lu}[\p{Lu}\p{N}]{1,19}(?![\p{L}\p{N}])/gu)) {
      // N-M6-13: numeral romano ("século XX", "capítulo II") não é sigla, a menos que esteja no cadastro.
      if (/^[IVXLCDM]+$/.test(m[0]) && !cadastro.has(chaveDeSigla(m[0]))) continue;
      const s = cadastro.get(chaveDeSigla(m[0]));
      saida.push({ codigo: s ? 'SIGLA_SEM_LIGACAO' : 'SIGLA_SEM_CADASTRO', secao, no: noId, trecho: m[0], ...(s ? { sigla: s.id } : {}), mensagem: s ? `“${m[0]}” está no cadastro: confira se deseja ligar esta ocorrência à sigla.` : `“${m[0]}” pode ser uma sigla sem cadastro; confira.`, rn: ['RN-046'] });
      if (saida.length >= MAXIMO) return;
    }
  };
  const visitar = (s: Secao) => {
    const conteudo = (itens: readonly Inline[], no: string) => {
      let texto = '';
      const descarregar = () => { if (saida.length < MAXIMO) verificar(texto, s.id, no); texto = ''; };
      for (const i of itens) {
        if (i.tipo === 'texto') texto += i.texto;
        else {
          descarregar();
          if (i.tipo === 'nota') conteudo(i.conteudo, i.id);
          const s = i.tipo === 'sigla' ? porId.get(i.sigla) : undefined;
          if (s && !apresentadas.has(s.id)) {
            apresentadas.add(s.id);
            const palavras = [...s.extenso.toLocaleLowerCase('pt-BR').matchAll(PALAVRA)].map((m) => m[0]);
            // Forma de uma palavra só e curta ("a", "de") daria aviso demais: fica de fora.
            if (palavras.length > 1 || (palavras[0]?.length ?? 0) >= 3) {
              let no = raizExtensos;
              for (const w of palavras) {
                let filho = no.filhos.get(w);
                if (!filho) no.filhos.set(w, (filho = { filhos: new Map() }));
                no = filho;
              }
              no.fim ??= { sigla: s.sigla, extenso: s.extenso };
            }
          }
        }
        if (saida.length >= MAXIMO) return;
      }
      descarregar();
    };
    // N-M6-02: a citação longa é reprodução exata do original (Manual, p. 22, 3.1): não se sugere mexer nela.
    for (const b of s.blocos) {
      if (b.tipo === 'citacaoLonga') continue;
      for (const c of conteudosDoBloco(b)) { conteudo(c, b.id); if (saida.length >= MAXIMO) return; }
    }
    for (const sub of s.subsecoes) { visitar(sub); if (saida.length >= MAXIMO) return; }
  };
  for (const s of secoesDeLeitura(doc)) { visitar(s); if (saida.length >= MAXIMO) break; }
  return saida;
}
