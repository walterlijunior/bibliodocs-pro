// Aba Escrever: o trabalho aberto com o título editável, os botões Salvar e Fechar e os avisos da sessão (M1-T11: erro
// ao salvar com "Salvar como…", arquivo sem .bdp, versão futura). M2-T06: a lista das seções, numeradas pela posição,
// e o editor da seção escolhida (uma seção por vez, decisão da preparação do M2). M2-T07: a árvore de seções, com nova,
// subir, descer, recuar, promover, excluir e arrastar (`ArvoreSecoes`); a seção ativa e a ordem única de desfazer vêm
// de `useEstrutura`, acima da aba. M2-T08: a lista dos elementos pré-textuais e o formulário do escolhido, no lugar do
// editor da seção. Texto sempre como texto (nunca HTML).
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { AcaoAviso, AlteracaoDados, AvisoSessao, CamposElemento, ConteudoDaSecao, EstadoSessao } from '../../aplicacao';
import type { ElementoPreTextualId, Secao } from '../../dominio/modelo';
import { rotuloTipo } from '../biblioteca/selecao';
import { EditorSecao, type ControleEditor } from '../editor/EditorSecao';
import { Icone, Pequi } from '../Icones';
import { ArvoreSecoes } from './ArvoreSecoes';
import { FormularioElemento, ListaElementos, ROTULOS_ELEMENTO } from './PreTextuais';
import type { Estrutura, PedidoFoco } from './useEstrutura';

export const ID_CAMPO_TITULO = 'campo-titulo';

export interface PropsAreaEscrever {
  estado: EstadoSessao;
  /** Rótulo do botão de descartar: "Fechar sem salvar" ou, quando o usuário pediu para sair, "Sair sem salvar". */
  rotuloDescartar: string;
  ocupado: boolean;
  aoAlterarTitulo: (texto: string) => void;
  aoSalvar: () => void;
  aoFechar: () => void;
  aoAcao: (acao: AcaoAviso) => void;
  aoCriar: () => void;
  aoAbrir: () => void;
  aoIrParaBiblioteca: () => void;
  /** Seção do trabalho aberto, para o editor montar. */
  lerSecao: (id: string) => Secao | null;
  aoAlterarSecao: (id: string, conteudo: ConteudoDaSecao) => void;
  /** Seção ativa, operações da árvore e desfazer (M2-T07). */
  estrutura: Pick<
    Estrutura,
    | 'memoria'
    | 'ativa'
    | 'escolher'
    | 'novaSecao'
    | 'operar'
    | 'moverJunto'
    | 'historico'
    | 'pedirFoco'
    | 'pedidoFoco'
    | 'consumirFoco'
    | 'aviso'
    | 'registrarTexto'
  >;
  /** Dados de identificação e elementos pré-textuais (M2-T08). */
  elementos: {
    alterarDados: (a: AlteracaoDados) => void;
    alterarSubtitulo: (texto: string) => void;
    alterar: (id: string, campos: CamposElemento) => void;
    incluir: (tipo: ElementoPreTextualId) => string | null;
    retirar: (id: string) => boolean;
  };
  /** O formulário de um elemento está no lugar do editor: o menu Inserir › Nota de rodapé fica desativado. */
  aoMudarFormulario?: (aberto: boolean) => void;
  /** O editor da seção aberta, para os menus Editar e Inserir. */
  controleEditor: RefObject<ControleEditor | null>;
}

export function AreaEscrever(p: PropsAreaEscrever) {
  const t = p.estado.trabalho;
  const e = p.estrutura;
  const [avisosEditor, setAvisosEditor] = useState<readonly string[]>([]);
  const refArvore = useRef<HTMLUListElement>(null);
  const refEscrever = useRef<HTMLDivElement>(null);
  const { controleEditor } = p;
  // Elemento na tela no lugar do editor. Outra seção ativa (árvore, barra superior, desfazer) volta ao editor.
  const [elementoId, setElementoId] = useState<string | null>(null);
  const [anuncioElemento, setAnuncioElemento] = useState<string | null>(null);
  const ativaId = e.ativa?.id ?? null;
  useEffect(() => setElementoId(null), [ativaId, t?.geracao]);
  const comFormulario = elementoId !== null && (t?.preTextuais?.lista.some((x) => x.id === elementoId) ?? false);
  const { aoMudarFormulario } = p;
  useEffect(() => {
    aoMudarFormulario?.(comFormulario);
    return () => aoMudarFormulario?.(false);
  }, [comFormulario, aoMudarFormulario]);
  const { pedidoFoco, consumirFoco } = e;
  // Depois de mudar de seção ou de estrutura: o foco vai ao editor (já montado: os efeitos do filho rodam antes), ao
  // título ou ao item ativo da árvore (sem seções, ao botão "Nova seção").
  useEffect(() => {
    if (pedidoFoco === null) return;
    if (pedidoFoco.alvo === 'editor') controleEditor.current?.focar();
    else if (pedidoFoco.alvo === 'editorSePerdido') {
      if (!controleEditor.current?.temFoco()) controleEditor.current?.focar();
    }
    else if (pedidoFoco.alvo === 'titulo') controleEditor.current?.focarTitulo();
    else {
      const item = refArvore.current?.querySelector<HTMLElement>('[role="treeitem"][aria-selected="true"]');
      (item ?? refEscrever.current?.querySelector<HTMLElement>('.acoes-secao__nova'))?.focus();
    }
    consumirFoco();
  }, [pedidoFoco, consumirFoco, controleEditor]);

  if (t === null) {
    return (
      <div className="estado">
        <Pequi />
        <h2>Nenhum trabalho aberto</h2>
        <p>Abra um trabalho da Biblioteca ou comece um novo.</p>
        <div className="acoes">
          <button type="button" className="btn-principal" onClick={p.aoCriar} disabled={p.ocupado}>
            Novo trabalho
          </button>
          <button type="button" className="btn-secundario" onClick={p.aoAbrir} disabled={p.ocupado}>
            Abrir…
          </button>
          <button type="button" className="btn-secundario" onClick={p.aoIrParaBiblioteca}>
            Ir para a Biblioteca
          </button>
        </div>
      </div>
    );
  }

  const secoes = t.secoes;
  const ativa = e.ativa;
  const pre = t.preTextuais;
  const elementoAtivo = pre?.lista.find((x) => x.id === elementoId) ?? null;
  const escolher = (id: string, foco: PedidoFoco['alvo'] | null) => {
    setElementoId(null);
    e.escolher(id, foco);
    setAvisosEditor([]);
  };

  return (
    <>
      <div className="principal__cab">
        <h1>Escrever</h1>
        <div className="acoes">
          {t.podeSalvar && (
            <button type="button" className="btn-principal" onClick={p.aoSalvar} aria-keyshortcuts="Control+S">
              Salvar
            </button>
          )}
          {!t.somenteLeitura && !t.podeSalvar && (
            <button type="button" className="btn-principal" onClick={() => p.aoAcao('salvarComo')} aria-keyshortcuts="Control+Shift+S">
              Salvar como…
            </button>
          )}
          <button type="button" className="btn-secundario" onClick={p.aoFechar} aria-keyshortcuts="Control+W">
            Fechar trabalho
          </button>
        </div>
      </div>

      <ul className="avisos" aria-label="Avisos do trabalho" hidden={p.estado.avisos.length === 0}>
        {p.estado.avisos.map((a) => (
          <AvisoComAcoes key={a.texto} aviso={a} rotuloDescartar={p.rotuloDescartar} aoAcao={p.aoAcao} />
        ))}
      </ul>

      <form className="formulario formulario--compacto" onSubmit={(ev) => ev.preventDefault()} aria-label="Dados do trabalho">
        <label htmlFor={ID_CAMPO_TITULO}>Título do trabalho</label>
        <input
          id={ID_CAMPO_TITULO}
          className="campo"
          type="text"
          value={t.titulo}
          placeholder="Sem título"
          readOnly={t.somenteLeitura}
          aria-describedby="dica-titulo"
          spellCheck={false}
          onChange={(ev) => p.aoAlterarTitulo(ev.target.value)}
        />
        <p className="dica" id="dica-titulo">
          {t.somenteLeitura
            ? 'Somente leitura: este trabalho foi gravado por uma versão mais nova do BiblioDocs Pro.'
            : 'As alterações são salvas sozinhas 30 segundos depois da última edição, ao trocar de trabalho e ao fechar. Ctrl+S salva na hora.'}
        </p>
        <dl className="formulario__dados">
          <dt>Arquivo</dt>
          <dd>{t.nomeArquivo}</dd>
          <dt>Tipo</dt>
          <dd>{rotuloTipo(t.tipoTrabalho)}</dd>
        </dl>
      </form>

      <div className="escrever" ref={refEscrever}>
        <div className="escrever__coluna">
        {pre !== null && (
          <ListaElementos
            elementos={pre.resumos}
            ausentes={pre.ausentes}
            pendenciasGerais={pre.pendencias.filter((x) => !pre.lista.some((el) => el.tipo === x.elemento))}
            ativoId={elementoAtivo?.id ?? null}
            somenteLeitura={t.somenteLeitura}
            anuncio={anuncioElemento}
            aoEscolher={(id) => {
              setAnuncioElemento(null);
              setElementoId(id);
            }}
            aoIncluir={(tipo) => {
              const id = p.elementos.incluir(tipo);
              if (id !== null) {
                setElementoId(id);
                setAnuncioElemento(`${ROTULOS_ELEMENTO[tipo]} incluído. Ctrl+Z desfaz.`);
              }
            }}
            aoHistorico={e.historico}
          />
        )}
        <ArvoreSecoes
          secoes={secoes}
          ativaId={ativa?.id ?? null}
          somenteLeitura={t.somenteLeitura}
          aviso={e.aviso}
          refArvore={refArvore}
          aoEscolher={escolher}
          aoNova={() => {
            setAvisosEditor([]);
            e.novaSecao();
          }}
          aoOperar={(acao, foco) => e.operar(acao, foco)}
          aoMover={(id, alvo, lado) => e.moverJunto(id, alvo, lado)}
          aoHistorico={e.historico}
          aoIrAoTexto={e.pedirFoco}
        />
        </div>

        <section className="escrever__texto" aria-labelledby={elementoAtivo ? undefined : 'titulo-secao-ativa'} aria-label={elementoAtivo ? 'Elemento pré-textual' : undefined}>
          {elementoAtivo !== null && pre !== null ? (
            <FormularioElemento
              key={elementoAtivo.id}
              elemento={elementoAtivo}
              dados={pre.dados}
              subtitulo={pre.subtitulo}
              sugerido={pre.resumos.find((x) => x.id === elementoAtivo.id)?.sugerido === true}
              rotuloOrientador={t.tipoTrabalho === 'projeto-pesquisa' ? 'Coordenador(a)' : 'Orientador(a)'}
              pendencias={pre.pendencias.filter((x) => x.elemento === elementoAtivo.tipo)}
              somenteLeitura={t.somenteLeitura}
              aoAlterarDados={p.elementos.alterarDados}
              aoAlterarSubtitulo={p.elementos.alterarSubtitulo}
              aoAlterarElemento={p.elementos.alterar}
              aoRetirar={(id) => {
                if (p.elementos.retirar(id)) {
                  setElementoId(null);
                  setAnuncioElemento(`${ROTULOS_ELEMENTO[elementoAtivo.tipo]} retirado. Ctrl+Z desfaz.`);
                  refEscrever.current?.querySelector<HTMLElement>('.elementos__item')?.focus();
                }
              }}
            />
          ) : ativa === null ? (
            <p className="dica" id="titulo-secao-ativa">
              {t.somenteLeitura ? 'Este trabalho não tem seções.' : 'Use “Nova seção” para começar o texto.'}
            </p>
          ) : (
            <>
              <h2 className="escrever__numero" id="titulo-secao-ativa">
                Seção {ativa.indicativo}
              </h2>
              <EditorSecao
                secaoId={ativa.id}
                geracao={t.geracao}
                memoria={e.memoria}
                ler={p.lerSecao}
                somenteLeitura={t.somenteLeitura}
                rotulo={`Texto da seção ${ativa.indicativo}`}
                aoAlterar={p.aoAlterarSecao}
                aoRegistrarTexto={e.registrarTexto}
                aoHistorico={e.historico}
                aoAvisar={setAvisosEditor}
                controle={controleEditor}
              />
            </>
          )}
          <ul className="avisos" aria-label="Avisos do editor" hidden={avisosEditor.length === 0}>
            {avisosEditor.map((texto) => (
              <li key={texto} className="aviso">
                <Icone nome="alerta" />
                <span className="aviso__texto" role="status">
                  {texto}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

const ROTULOS_ACAO: Record<Exclude<AcaoAviso, 'descartar'>, string> = { salvarComo: 'Salvar como…' };

function AvisoComAcoes({ aviso, rotuloDescartar, aoAcao }: { aviso: AvisoSessao; rotuloDescartar: string; aoAcao: (a: AcaoAviso) => void }) {
  const classe = aviso.nivel === 'erro' ? 'aviso aviso--erro' : aviso.nivel === 'info' ? 'aviso aviso--info' : 'aviso';
  const papel = aviso.nivel === 'erro' ? 'alert' : aviso.nivel === 'info' ? 'status' : undefined;
  const icone = aviso.nivel === 'erro' ? 'erro' : aviso.nivel === 'info' ? 'ok' : 'alerta';
  return (
    // O papel vivo fica no texto, não no <li> (que perderia o papel de item de lista).
    <li className={classe}>
      <Icone nome={icone} />
      <span className="aviso__texto" role={papel}>
        {aviso.texto}
      </span>
      {aviso.acoes.length > 0 && (
        <span className="aviso__acoes">
          {aviso.acoes.map((a) => (
            <button key={a} type="button" className="btn-secundario" onClick={() => aoAcao(a)}>
              {a === 'descartar' ? rotuloDescartar : ROTULOS_ACAO[a]}
            </button>
          ))}
        </span>
      )}
    </li>
  );
}
