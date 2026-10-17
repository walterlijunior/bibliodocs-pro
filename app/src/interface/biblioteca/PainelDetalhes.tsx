// Painel de detalhes do trabalho selecionado. A conformidade só existe a partir do M4 (verificador); abrir, renomear,
// duplicar e excluir pela interface entram com o fluxo do M1-T11.
import { useEffect, useRef } from 'react';
import type { ItemBiblioteca } from '../../aplicacao';
import { avisoDoItem, formatarDataHora, formatarTamanho, rotuloTipo, tituloExibido } from './selecao';

export interface PropsPainelDetalhes {
  item: ItemBiblioteca;
  aoFechar: () => void;
}

export function PainelDetalhes({ item, aoFechar }: PropsPainelDetalhes) {
  const painel = useRef<HTMLElement>(null);
  const aviso = avisoDoItem(item);

  useEffect(() => {
    const el = painel.current;
    if (!el) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        aoFechar();
      }
    };
    el.addEventListener('keydown', esc);
    return () => el.removeEventListener('keydown', esc);
  }, [aoFechar]);

  return (
    <aside className="detalhes" aria-label="Detalhes do trabalho" ref={painel}>
      <h2>{tituloExibido(item)}</h2>
      <dl>
        <dt>Arquivo</dt>
        <dd>{item.nomeArquivo}</dd>
        {item.estado === 'ok' && (
          <>
            <dt>Tipo</dt>
            <dd>{rotuloTipo(item.tipoTrabalho)}</dd>
          </>
        )}
        {item.criadoEm !== null && (
          <>
            <dt>Criado em</dt>
            <dd>{formatarDataHora(item.criadoEm)}</dd>
          </>
        )}
        {item.atualizadoEm !== null && (
          <>
            <dt>Atualizado em</dt>
            <dd>{formatarDataHora(item.atualizadoEm)}</dd>
          </>
        )}
        <dt>Modificado no disco</dt>
        <dd>{formatarDataHora(item.modificadoEm)}</dd>
        <dt>Tamanho</dt>
        <dd>{formatarTamanho(item.bytes)}</dd>
      </dl>
      {aviso !== null && (
        <p role="note">
          {item.estado === 'versaoFutura'
            ? 'Este trabalho foi gravado por uma versão mais nova do BiblioDocs Pro. Atualize o aplicativo para editá-lo.'
            : 'Este arquivo não pôde ser lido como trabalho do BiblioDocs Pro. Ele não foi alterado.'}
        </p>
      )}
      <h3>Conformidade</h3>
      <p>A verificação de conformidade ainda não está disponível nesta versão.</p>
      <div className="acoes">
        <button type="button" className="btn-secundario" onClick={aoFechar}>
          Fechar painel
        </button>
      </div>
    </aside>
  );
}
