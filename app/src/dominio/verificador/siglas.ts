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

export function conferirSiglas(doc: Pick<Documento, 'corpo'> & Partial<Pick<Documento, 'siglas' | 'posTextuais'>>): ProblemaSigla[] {
  const saida: ProblemaSigla[] = [];
  const MAXIMO = MAXIMO_PROBLEMAS_SIGLAS;
  const cadastro = new Map((doc.siglas ?? []).map((s) => [chaveDeSigla(s.sigla), s]));
  const ids = new Set((doc.siglas ?? []).map((s) => s.id));
  const porId = new Map((doc.siglas ?? []).map((s) => [s.id, s]));
  // RN-047 (2.ª parte, M6-T07): depois da primeira ocorrência ligada, a forma por extenso de novo vira aviso.
  const apresentadas = new Map<string, { sigla: string; extenso: string; minusculo: string }>();
  for (const o of ocorrenciasDeSiglas(doc)) {
    if (!ids.has(o.inline.sigla)) saida.push({ codigo: 'SIGLA_QUEBRADA', secao: o.secao, no: o.no, trecho: '[sigla sem cadastro]', sigla: o.inline.sigla, mensagem: 'A sigla ligada no texto não está mais no cadastro.', rn: ['RN-046'] });
    if (saida.length >= MAXIMO) return saida;
  }
  const verificar = (texto: string, secao: string, no: string) => {
    if (apresentadas.size > 0) {
      const minusculo = texto.toLocaleLowerCase('pt-BR');
      for (const a of apresentadas.values()) {
        if (a.minusculo.length < 3 || !minusculo.includes(a.minusculo)) continue;
        saida.push({ codigo: 'SIGLA_EXTENSO_REPETIDO', secao, no, trecho: a.extenso, mensagem: `“${a.extenso}” já foi apresentado com a sigla ${a.sigla}; nas ocorrências seguintes, use só a sigla.`, rn: ['RN-047'] });
        if (saida.length >= MAXIMO) return;
      }
    }
    for (const m of texto.matchAll(/(?<![\p{L}\p{N}])\p{Lu}[\p{Lu}\p{N}]{1,19}(?![\p{L}\p{N}])/gu)) {
      const s = cadastro.get(chaveDeSigla(m[0]));
      saida.push({ codigo: s ? 'SIGLA_SEM_LIGACAO' : 'SIGLA_SEM_CADASTRO', secao, no, trecho: m[0], ...(s ? { sigla: s.id } : {}), mensagem: s ? `“${m[0]}” está no cadastro: confira se deseja ligar esta ocorrência à sigla.` : `“${m[0]}” pode ser uma sigla sem cadastro; confira.`, rn: ['RN-046'] });
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
          if (s && !apresentadas.has(s.id)) apresentadas.set(s.id, { sigla: s.sigla, extenso: s.extenso, minusculo: s.extenso.trim().toLocaleLowerCase('pt-BR') });
        }
        if (saida.length >= MAXIMO) return;
      }
      descarregar();
    };
    for (const b of s.blocos) for (const c of conteudosDoBloco(b)) { conteudo(c, b.id); if (saida.length >= MAXIMO) return; }
    for (const sub of s.subsecoes) { visitar(sub); if (saida.length >= MAXIMO) return; }
  };
  for (const s of secoesDeLeitura(doc)) { visitar(s); if (saida.length >= MAXIMO) break; }
  return saida;
}
