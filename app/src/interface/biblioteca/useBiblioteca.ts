/**
 * Estado da biblioteca no renderer (M1-T10): carrega a lista pelo contrato `window.bibliodocs.biblioteca` (M1-T09),
 * troca a pasta, cria, abre, renomeia, duplica e exclui trabalho. Resposta atrasada de uma chamada antiga é descartada
 * (contador de pedidos).
 *
 * Desde o M1-T11 o trabalho criado continua aberto: `criar` devolve o `ProjetoAberto` para a sessão de edição, e
 * `abrir` devolve o `ResultadoAbrir` para quem chamou decidir (editar, só leitura ou mensagem).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ApiBiblioDocs,
  IdentificadorItem,
  ItemBiblioteca,
  PastaBiblioteca,
  ProjetoAberto,
  ResultadoAbrir,
  ResultadoListar,
} from '../../aplicacao';
import type { TipoTrabalhoUft } from '../../dominio/modelo';

export type EstadoBiblioteca =
  | { fase: 'carregando' }
  | { fase: 'erro'; mensagem: string }
  | { fase: 'pronta'; pasta: PastaBiblioteca; itens: ItemBiblioteca[]; avisos: string[] };

export interface MensagemAcao {
  tipo: 'erro' | 'info';
  texto: string;
}

export const FALHA_INESPERADA = 'O aplicativo não conseguiu falar com a biblioteca. Tente de novo; se continuar, reinicie o aplicativo.';

/** Orientação extra para `ABERTO_NO_APP` (o trabalho está aberto na aba Escrever). */
export const ORIENTACAO_ABERTO = 'Ele está aberto na aba Escrever: use Arquivo › Fechar trabalho (Ctrl+W).';

/** Resultado de renomear pela interface: a mensagem volta para o campo do nome. */
export type ResultadoRenomearUi = { ok: true; id: IdentificadorItem } | { ok: false; mensagem: string };

export function useBiblioteca(api: ApiBiblioDocs) {
  const [estado, setEstado] = useState<EstadoBiblioteca>({ fase: 'carregando' });
  const [mensagem, setMensagem] = useState<MensagemAcao | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const pedido = useRef(0);
  // Trava síncrona: `ocupado` só muda na próxima renderização, e duas teclas seguidas passariam as duas (revisão M1-T11).
  const trava = useRef(false);

  const aplicar = useCallback((r: ResultadoListar, n: number) => {
    if (n !== pedido.current) return;
    setEstado(r.ok ? { fase: 'pronta', pasta: r.pasta, itens: r.itens, avisos: r.avisos } : { fase: 'erro', mensagem: r.mensagem });
  }, []);

  const recarregar = useCallback(async () => {
    const n = ++pedido.current;
    setEstado((e) => (e.fase === 'pronta' ? e : { fase: 'carregando' }));
    try {
      aplicar(await api.biblioteca.listar(), n);
    } catch {
      if (n === pedido.current) setEstado({ fase: 'erro', mensagem: FALHA_INESPERADA });
    }
  }, [api, aplicar]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  const escolherPasta = useCallback(async () => {
    setMensagem(null);
    const n = ++pedido.current;
    try {
      const r = await api.biblioteca.escolherPasta();
      if (!r.ok && r.motivo === 'CANCELADO') return;
      aplicar(r, n);
    } catch {
      setMensagem({ tipo: 'erro', texto: FALHA_INESPERADA });
    }
  }, [api, aplicar]);

  /** Uma ação por vez; erro inesperado vira mensagem. */
  const acao = useCallback(
    async <T,>(executar: () => Promise<T>): Promise<T | null> => {
      if (trava.current) return null;
      trava.current = true;
      setOcupado(true);
      setMensagem(null);
      try {
        return await executar();
      } catch {
        setMensagem({ tipo: 'erro', texto: FALHA_INESPERADA });
        return null;
      } finally {
        trava.current = false;
        setOcupado(false);
      }
    },
    [],
  );

  const falhou = useCallback((codigo: string, texto: string) => {
    setMensagem({ tipo: 'erro', texto: codigo === 'ABERTO_NO_APP' ? `${texto} ${ORIENTACAO_ABERTO}` : texto });
  }, []);

  /** Cria um trabalho já aberto (o identificador de gravação fica com a sessão de edição). */
  const criar = useCallback(
    (tipo: TipoTrabalhoUft) =>
      acao(async (): Promise<{ projeto: ProjetoAberto; id: IdentificadorItem } | null> => {
        const r = await api.biblioteca.criar(tipo);
        if (!r.ok) {
          falhou(r.codigo, r.mensagem);
          return null;
        }
        await recarregar();
        return { projeto: r.projeto, id: r.item.identificador };
      }),
    [acao, api, falhou, recarregar],
  );

  /** Lê um trabalho da lista; quem chama decide o que fazer com o resultado. */
  const abrir = useCallback((id: IdentificadorItem) => acao((): Promise<ResultadoAbrir> => api.biblioteca.abrir(id)), [acao, api]);

  const renomear = useCallback(
    async (id: IdentificadorItem, novoNome: string): Promise<ResultadoRenomearUi> => {
      const r = await acao(() => api.biblioteca.renomear(id, novoNome));
      if (r === null) return { ok: false, mensagem: FALHA_INESPERADA };
      if (!r.ok) return { ok: false, mensagem: r.codigo === 'ABERTO_NO_APP' ? `${r.mensagem} ${ORIENTACAO_ABERTO}` : r.mensagem };
      setMensagem({ tipo: 'info', texto: `Trabalho renomeado: ${r.item.nomeArquivo}` });
      await recarregar();
      return { ok: true, id: r.item.identificador };
    },
    [acao, api, recarregar],
  );

  /** Duplica e devolve o identificador da cópia (ou `null`). */
  const duplicar = useCallback(
    async (id: IdentificadorItem): Promise<IdentificadorItem | null> => {
      const r = await acao(() => api.biblioteca.duplicar(id));
      if (r === null) return null;
      if (!r.ok) {
        falhou(r.codigo, r.mensagem);
        return null;
      }
      setMensagem({ tipo: 'info', texto: `Cópia criada: ${r.item.nomeArquivo}` });
      await recarregar();
      return r.item.identificador;
    },
    [acao, api, falhou, recarregar],
  );

  /** Pede ao usuário que confirme (diálogo do principal) e envia para a Lixeira; `true` se excluiu. */
  const excluir = useCallback(
    async (id: IdentificadorItem, nomeArquivo: string): Promise<boolean> => {
      const r = await acao(() => api.biblioteca.excluir(id));
      if (r === null || (!r.ok && r.motivo === 'CANCELADO')) return false;
      if (!r.ok) {
        falhou(r.codigo, r.mensagem);
        return false;
      }
      setMensagem({ tipo: 'info', texto: `“${nomeArquivo}” foi para a Lixeira.` });
      await recarregar();
      return true;
    },
    [acao, api, falhou, recarregar],
  );

  return {
    estado,
    mensagem,
    ocupado,
    recarregar,
    escolherPasta,
    criar,
    abrir,
    renomear,
    duplicar,
    excluir,
    mostrarMensagem: setMensagem,
    limparMensagem: () => setMensagem(null),
  };
}
