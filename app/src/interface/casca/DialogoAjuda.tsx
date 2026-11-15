/**
 * Ajuda › Guia rápido (F1) e Ajuda › Atalhos de teclado (F-E6-01). Texto fixo da interface; os atalhos dos menus vêm de
 * `MENUS`, para a lista não ficar diferente do que os menus mostram.
 */
import { useEffect, useId, useRef } from 'react';
import { ATALHOS_EXTRAS, atalhosDosMenus } from './atalhos';

export type TipoAjuda = 'guia' | 'atalhos';

export function DialogoAjuda({ tipo, aoFechar }: { tipo: TipoAjuda; aoFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const base = useId();
  useEffect(() => {
    const d = ref.current;
    const anterior = document.activeElement;
    if (d && !d.open) d.showModal();
    return () => {
      d?.close();
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialogo"
      aria-labelledby={`${base}-titulo`}
      onCancel={(e) => {
        e.preventDefault();
        aoFechar();
      }}
    >
      <div className="dialogo__corpo">
        <h2 id={`${base}-titulo`}>{tipo === 'guia' ? 'Guia rápido' : 'Atalhos de teclado'}</h2>
        <div className="lista-rolavel ajuda" tabIndex={0} aria-labelledby={`${base}-titulo`}>
          {tipo === 'guia' ? <Guia /> : <Atalhos />}
        </div>
        <div className="dialogo__acoes">
          <button type="button" className="btn-principal" onClick={aoFechar}>
            Fechar
          </button>
        </div>
      </div>
    </dialog>
  );
}

function Guia() {
  return (
    <ol className="ajuda__passos">
      <li>
        <strong>Crie o trabalho.</strong> Na Biblioteca, “Novo trabalho” (Ctrl+N) e escolha o tipo: monografia, artigo,
        dissertação, tese, relatório técnico ou projeto de pesquisa. O trabalho já nasce com os elementos e as seções do tipo.
      </li>
      <li>
        <strong>Preencha os dados.</strong> Na aba Elementos (Trabalho › Dados do trabalho…), escolha a capa ou a folha de
        rosto e preencha autor, orientador, curso, cidade e ano. Inclua ou retire elementos pré-textuais e pós-textuais.
      </li>
      <li>
        <strong>Escreva.</strong> Na aba Escrever, cada seção tem o seu texto, numa folha do tamanho da página do perfil,
        com a régua das margens. O painel Seções, à esquerda, cria, renomeia (F2), move, recua e promove seções; a página
        mostra o número e o título. O menu Inserir põe citações, tabelas, figuras, gráficos, equações, remissivas, notas de
        rodapé e siglas no ponto do cursor. “Buscar no documento” (Ctrl+F nesta aba) acha um termo em todas as seções.
      </li>
      <li>
        <strong>Traga tabelas e quadros de planilhas.</strong> Inserir › Tabelas de planilha (.xlsx)… (ou “Importar
        planilha…” na aba Elementos): escolha as abas e os intervalos, confira a prévia e insira todos de uma vez. Também
        dá para colar as células do Excel na janela da tabela. Um quadro em imagem entra pela janela da figura, com a
        espécie “Quadro”.
      </li>
      <li>
        <strong>Cadastre as referências.</strong> Na aba Referências, inclua as obras (ou importe BibTeX e RIS) e use
        “Conferir” para achar obras sem citação e citações sem obra. A referência pronta do portal (SciELO, Google
        Acadêmico) pode ser colada na obra e convertida em campos; relatórios de RI e demonstrações financeiras têm tipos
        próprios.
      </li>
      <li>
        <strong>Confira.</strong> A aba Conformidade (F7) mostra, por categoria, quantos itens há no trabalho, quantos
        estão sem ocorrência e quantos têm pendência ou aviso, com o local de cada um; F8 leva à próxima. O relatório pode
        ser exportado.
      </li>
      <li>
        <strong>Exporte.</strong> Exportar › Exportar DOCX… (Ctrl+E) gera o arquivo do Word com a formatação do Manual da
        UFT: margens, fonte, espaçamento, sumário, listas e referências.
      </li>
      <li>
        O trabalho é salvo sozinho 30 segundos depois da última edição, ao trocar de trabalho e ao fechar; Ctrl+S salva na
        hora. Se o app fechar de repente, a Biblioteca oferece recuperar o que estava aberto.
      </li>
      <li>
        <strong>Guarde os cadastros.</strong> Arquivo › Criar backup de cadastros e configurações… grava instituições,
        cursos, docentes, perfis e preferências num arquivo (num pendrive, por exemplo); Restaurar backup… os traz de volta
        numa instalação nova. Os trabalhos ficam nos arquivos .bdp e nas cópias de segurança.
      </li>
    </ol>
  );
}

function Atalhos() {
  const grupos = [...atalhosDosMenus(), ...ATALHOS_EXTRAS];
  return (
    <>
      {grupos.map((g) => (
        <section key={g.grupo}>
          <h3>{g.grupo}</h3>
          <dl className="ajuda__atalhos">
            {g.itens.map(([tecla, acao]) => (
              <div key={tecla + acao}>
                <dt>
                  <kbd>{tecla}</kbd>
                </dt>
                <dd>{acao}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </>
  );
}
