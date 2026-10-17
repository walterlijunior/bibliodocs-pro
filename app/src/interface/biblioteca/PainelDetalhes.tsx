// Painel de detalhes do trabalho selecionado: dados do arquivo e as ações abrir, renomear, duplicar e excluir
// (M1-T11). A conformidade só existe a partir do M4 (verificador). O nome digitado vai cru ao principal, que valida e
// devolve a mensagem (M1-T09); excluir pede que o usuário confirme num diálogo do principal e envia para a Lixeira.
import { useEffect, useRef, useState } from 'react';
import type { ItemBiblioteca } from '../../aplicacao';
import { avisoDoItem, formatarDataHora, formatarTamanho, rotuloTipo, tituloExibido } from './selecao';
import type { ResultadoRenomearUi } from './useBiblioteca';

export interface PropsPainelDetalhes {
  item: ItemBiblioteca;
  aoFechar: () => void;
  ocupado?: boolean;
  aoAbrir?: () => void;
  aoRenomear?: (novoNome: string) => Promise<ResultadoRenomearUi>;
  aoDuplicar?: () => void;
  aoExcluir?: () => void;
}

const ID_CAMPO_NOME = 'campo-novo-nome';
const ID_ERRO_NOME = 'erro-novo-nome';

const semExtensao = (nome: string) => nome.replace(/\.bdp$/i, '');

export function PainelDetalhes({ item, aoFechar, ocupado = false, aoAbrir, aoRenomear, aoDuplicar, aoExcluir }: PropsPainelDetalhes) {
  const painel = useRef<HTMLElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const botaoRenomear = useRef<HTMLButtonElement>(null);
  // Ao sair do renomear (confirmado, Esc ou Cancelar), o foco volta ao botão "Renomear…" (revisão do M1-T11).
  const devolverFoco = useRef(false);
  const [renomeando, setRenomeando] = useState(false);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const aviso = avisoDoItem(item);

  // Trocou o item selecionado: sai do modo renomear.
  useEffect(() => {
    setRenomeando(false);
    setErro(null);
  }, [item.identificador]);

  useEffect(() => {
    if (renomeando) {
      campo.current?.focus();
      campo.current?.select();
    } else if (devolverFoco.current) {
      devolverFoco.current = false;
      botaoRenomear.current?.focus();
    }
  }, [renomeando]);

  const sairDoRenomear = () => {
    devolverFoco.current = true;
    setRenomeando(false);
  };

  useEffect(() => {
    const el = painel.current;
    if (!el) return;
    const esc = (e: KeyboardEvent) => {
      // Esc no campo do nome cancela só o renomear (tratado no próprio campo).
      if (e.key === 'Escape' && !(e.target instanceof Element && e.target.closest('.renomear'))) {
        e.preventDefault();
        aoFechar();
      }
    };
    el.addEventListener('keydown', esc);
    return () => el.removeEventListener('keydown', esc);
  }, [aoFechar]);

  const comecarRenomear = () => {
    setNome(semExtensao(item.nomeArquivo));
    setErro(null);
    setRenomeando(true);
  };

  const confirmarRenomear = async () => {
    if (!aoRenomear) return;
    const r = await aoRenomear(nome);
    if (r.ok) {
      setErro(null);
      sairDoRenomear();
    } else {
      setErro(r.mensagem);
      campo.current?.focus();
    }
  };

  return (
    <aside className="detalhes" aria-label="Detalhes do trabalho" ref={painel}>
      <h2>{tituloExibido(item)}</h2>
      {renomeando ? (
        <form
          className="renomear"
          onSubmit={(e) => {
            e.preventDefault();
            void confirmarRenomear();
          }}
        >
          <label htmlFor={ID_CAMPO_NOME}>Novo nome do arquivo</label>
          <input
            ref={campo}
            id={ID_CAMPO_NOME}
            className="campo"
            type="text"
            value={nome}
            spellCheck={false}
            aria-invalid={erro !== null}
            aria-describedby={erro !== null ? ID_ERRO_NOME : undefined}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                sairDoRenomear();
              }
            }}
          />
          {erro !== null && (
            <p className="erro-campo" id={ID_ERRO_NOME} role="alert">
              {erro}
            </p>
          )}
          <div className="acoes">
            <button type="submit" className="btn-principal" disabled={ocupado}>
              Renomear
            </button>
            <button type="button" className="btn-secundario" onClick={sairDoRenomear}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
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
            ? 'Este trabalho foi gravado por uma versão mais nova do BiblioDocs Pro. Ele abre só para leitura; atualize o aplicativo para editá-lo.'
            : 'Este arquivo não pôde ser lido como trabalho do BiblioDocs Pro. Ele não foi alterado.'}
        </p>
      )}
      {!renomeando && (
        <div className="acoes">
          {aoAbrir && item.estado !== 'invalido' && (
            <button type="button" className="btn-principal" onClick={aoAbrir} disabled={ocupado}>
              Abrir
            </button>
          )}
          {aoRenomear && (
            <button ref={botaoRenomear} type="button" className="btn-secundario" onClick={comecarRenomear} disabled={ocupado}>
              Renomear…
            </button>
          )}
          {aoDuplicar && item.estado === 'ok' && (
            <button type="button" className="btn-secundario" onClick={aoDuplicar} disabled={ocupado}>
              Duplicar
            </button>
          )}
          {aoExcluir && (
            <button type="button" className="btn-secundario" onClick={aoExcluir} disabled={ocupado}>
              Excluir…
            </button>
          )}
        </div>
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
