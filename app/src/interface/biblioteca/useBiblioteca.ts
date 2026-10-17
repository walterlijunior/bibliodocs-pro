/**
 * Estado da biblioteca no renderer (M1-T10): carrega a lista pelo contrato `window.bibliodocs.biblioteca` (M1-T09),
 * troca a pasta e cria trabalho. Resposta atrasada de uma chamada antiga é descartada (contador de pedidos).
 *
 * Criar trabalho no M1-T10: ainda não há editor, então o trabalho criado é fechado logo em seguida (o identificador de
 * gravação não fica preso) e aparece selecionado na grade. O M1-T11 passa a mantê-lo aberto no editor.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiBiblioDocs, IdentificadorItem, ItemBiblioteca, PastaBiblioteca, ResultadoListar } from '../../aplicacao';

export type EstadoBiblioteca =
  | { fase: 'carregando' }
  | { fase: 'erro'; mensagem: string }
  | { fase: 'pronta'; pasta: PastaBiblioteca; itens: ItemBiblioteca[]; avisos: string[] };

export interface MensagemAcao {
  tipo: 'erro' | 'info';
  texto: string;
}

const FALHA_INESPERADA = 'O aplicativo não conseguiu falar com a biblioteca. Tente de novo; se continuar, reinicie o aplicativo.';

export function useBiblioteca(api: ApiBiblioDocs) {
  const [estado, setEstado] = useState<EstadoBiblioteca>({ fase: 'carregando' });
  const [mensagem, setMensagem] = useState<MensagemAcao | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const pedido = useRef(0);

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

  /** Cria um trabalho e devolve o identificador dele na lista nova (ou `null` se falhou). */
  const criar = useCallback(async (): Promise<IdentificadorItem | null> => {
    if (ocupado) return null;
    setOcupado(true);
    setMensagem(null);
    try {
      const r = await api.biblioteca.criar();
      if (!r.ok) {
        setMensagem({ tipo: 'erro', texto: r.mensagem });
        return null;
      }
      if (r.projeto.identificador !== null) await api.projetos.fechar(r.projeto.identificador);
      setMensagem({ tipo: 'info', texto: `Trabalho criado: ${r.item.nomeArquivo}` });
      await recarregar();
      return r.item.identificador;
    } catch {
      setMensagem({ tipo: 'erro', texto: FALHA_INESPERADA });
      return null;
    } finally {
      setOcupado(false);
    }
  }, [api, ocupado, recarregar]);

  return { estado, mensagem, ocupado, recarregar, escolherPasta, criar, limparMensagem: () => setMensagem(null) };
}
