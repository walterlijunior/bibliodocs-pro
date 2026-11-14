/**
 * Resumo de um `.bdp` para a biblioteca (título, tipo, datas). Lê e valida o arquivo inteiro, como na abertura, mas
 * não grava nada: um arquivo de formato antigo é migrado só em memória (o backup obrigatório fica para quando o
 * usuário o abrir de fato).
 *
 * Roda no processo leitor (`utilityProcess`), nunca no principal: o arquivo da pasta pode ter vindo de qualquer lugar
 * (regra do M1-T08 para todo `.bdp`).
 */
import { formatarReferencia, ordenarReferencias, textoDaReferencia } from '../../dominio/bibliografia';
import { textoPlano, type Documento } from '../../dominio/modelo';
import { alvosDeRemissiva } from '../../dominio/visuais';
import { lerArquivoLimitado } from '../arquivo/projeto-em-disco';
import { SISTEMA_ARQUIVOS_NODE, type SistemaArquivos } from '../arquivo/sistema-arquivos';
import { LIMITES_CONTEINER, type LimitesConteiner } from '../conteiner/limites';
import { lerProjeto } from '../conteiner/pacote';
import { MAX_ITENS_CONTEUDO, MAX_TEXTO_CONTEUDO, MAX_TITULO_INDICE, type ConteudoResumo, type ResumoProjeto } from './indice';

const cortar = (texto: string, max = MAX_TEXTO_CONTEUDO) => (texto.length > max ? `${texto.slice(0, max - 1)}…` : texto);

/**
 * Conteúdo de um trabalho para as coleções da Biblioteca (F-E6-01): referências formatadas na ordem da lista,
 * tabelas, quadros, figuras e gráficos numerados e as siglas cadastradas. Uma parte que falhe fica vazia.
 */
export function conteudoDoDocumento(documento: Documento): ConteudoResumo {
  const tentar = <T>(f: () => T[]): T[] => {
    try {
      return f().slice(0, MAX_ITENS_CONTEUDO);
    } catch {
      return [];
    }
  };
  return {
    referencias: tentar(() =>
      ordenarReferencias(documento.obras ?? [])
        .map((o) => cortar(textoDaReferencia(formatarReferencia(o))))
        .filter((t) => t !== ''),
    ),
    visuais: tentar(() =>
      alvosDeRemissiva(documento).flatMap((a) =>
        a.tipo === 'tabela' || a.tipo === 'ilustracao' || a.tipo === 'grafico'
          ? [{ tipo: a.tipo, rotulo: cortar(a.rotulo, 64), descricao: cortar(a.descricao) }]
          : [],
      ),
    ),
    siglas: tentar(() => (documento.siglas ?? []).map((s) => ({ sigla: cortar(s.sigla, 64), extenso: cortar(s.extenso) }))),
  };
}

/** Nunca lança: qualquer falha vira `{ estado: 'invalido' }`. */
export async function resumirProjeto(
  caminho: string,
  fs: SistemaArquivos = SISTEMA_ARQUIVOS_NODE,
  limites: LimitesConteiner = LIMITES_CONTEINER,
): Promise<ResumoProjeto> {
  try {
    const lido = await lerArquivoLimitado(caminho, fs, limites);
    if (!lido.ok) return { estado: 'invalido' };
    const r = lerProjeto(lido.bytes, limites);
    if (r.ok) {
      const { manifesto, documento } = r.pacote;
      return {
        estado: 'ok',
        id: manifesto.id,
        titulo: textoPlano(documento.metadados.titulo).slice(0, MAX_TITULO_INDICE),
        tipoTrabalho: manifesto.tipoTrabalho,
        criadoEm: manifesto.criadoEm,
        atualizadoEm: manifesto.atualizadoEm,
        conteudo: conteudoDoDocumento(documento),
      };
    }
    if (r.versaoFutura) return { estado: 'versaoFutura', versaoFormato: r.versaoFutura.versaoFormato };
    return { estado: 'invalido' };
  } catch {
    return { estado: 'invalido' };
  }
}
