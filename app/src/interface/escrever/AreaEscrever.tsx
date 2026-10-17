// Aba Escrever: o trabalho aberto com o título editável, os botões Salvar e Fechar e os avisos da sessão (M1-T11: erro
// ao salvar com "Salvar como…", arquivo sem .bdp, versão futura). M2-T06: a lista das seções, numeradas pela posição,
// e o editor da seção escolhida (uma seção por vez, decisão da preparação do M2). A árvore completa, com mover, recuar
// e promover, é do M2-T07; aqui só se acrescenta seção no fim. Texto sempre como texto (nunca HTML).
import { useEffect, useState, type RefObject } from 'react';
import type { AcaoAviso, AvisoSessao, ConteudoDaSecao, EstadoSessao, ResultadoInserirSecao } from '../../aplicacao';
import type { Secao } from '../../dominio/modelo';
import { rotuloTipo } from '../biblioteca/selecao';
import { EditorSecao, MemoriaEditores, type ControleEditor } from '../editor/EditorSecao';
import { Icone, Pequi } from '../Icones';

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
  aoNovaSecao: () => ResultadoInserirSecao;
  /** O editor da seção aberta, para os menus Editar e Inserir. */
  controleEditor: RefObject<ControleEditor | null>;
}

export function AreaEscrever(p: PropsAreaEscrever) {
  const t = p.estado.trabalho;
  const [memoria] = useState(() => new MemoriaEditores());
  // Seção escolhida no trabalho de `geracao` (outro trabalho aberto volta à primeira).
  const [escolha, setEscolha] = useState<{ geracao: number; id: string } | null>(null);
  const [avisosEditor, setAvisosEditor] = useState<readonly string[]>([]);
  const [focarEditor, setFocarEditor] = useState(0);
  const { controleEditor } = p;
  useEffect(() => {
    if (focarEditor > 0) controleEditor.current?.focar();
  }, [focarEditor, controleEditor]);
  const fechado = t === null;
  useEffect(() => {
    if (fechado) memoria.limpar();
  }, [fechado, memoria]);

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
  const ativa = secoes.find((s) => escolha !== null && escolha.geracao === t.geracao && s.id === escolha.id) ?? secoes[0] ?? null;
  const escolher = (id: string) => {
    setEscolha({ geracao: t.geracao, id });
    setAvisosEditor([]);
  };
  const novaSecao = () => {
    const r = p.aoNovaSecao();
    if (!r.ok) {
      setAvisosEditor([r.mensagem]);
      return;
    }
    escolher(r.id);
    setFocarEditor((n) => n + 1);
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

      <form className="formulario formulario--compacto" onSubmit={(e) => e.preventDefault()} aria-label="Dados do trabalho">
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
          onChange={(e) => p.aoAlterarTitulo(e.target.value)}
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

      <div className="escrever">
        <nav className="escrever__secoes" aria-labelledby="titulo-lista-secoes">
          <h2 id="titulo-lista-secoes">Seções</h2>
          {secoes.length === 0 ? (
            <p className="dica">Este trabalho ainda não tem seções.</p>
          ) : (
            <ol className="lista-secoes">
              {secoes.map((s) => (
                <li key={s.id} className={`lista-secoes__item lista-secoes__item--nivel${Math.min(s.nivel, 5)}`}>
                  <button
                    type="button"
                    className="lista-secoes__botao"
                    aria-current={s.id === ativa?.id ? 'true' : undefined}
                    onClick={() => escolher(s.id)}
                  >
                    <span className="lista-secoes__numero">{s.indicativo}</span>
                    <span className="lista-secoes__titulo">{s.titulo.trim() === '' ? 'Sem título' : s.titulo}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          {!t.somenteLeitura && (
            <button type="button" className="btn-secundario" onClick={novaSecao}>
              Nova seção
            </button>
          )}
        </nav>

        <section className="escrever__texto" aria-labelledby="titulo-secao-ativa">
          {ativa === null ? (
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
                memoria={memoria}
                ler={p.lerSecao}
                somenteLeitura={t.somenteLeitura}
                rotulo={`Texto da seção ${ativa.indicativo}`}
                aoAlterar={p.aoAlterarSecao}
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
