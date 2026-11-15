/**
 * Gerenciador de elementos (Etapa 4 da especificação de atualização), na aba Elementos.
 *
 * - `ListaVisuais` (coluna): tabelas, quadros, figuras, gráficos e equações numerados, na ordem do documento, com as
 *   contagens de remissivas, e os botões para criar um novo no ponto do cursor da aba Escrever.
 * - `PainelElemento` (no lugar do editor): prévia, título, fonte e nota, quantas remissivas e menções sem número, e as
 *   ações Ir ao texto, Editar e Inserir remissiva no cursor.
 * - `PainelMencoes` (no lugar do editor, sem elemento escolhido): menções escritas à mão ("Quadro 1" digitado), para
 *   ligar ao elemento, e as menções sem número já ligadas.
 *
 * Texto sempre como texto (nunca HTML). A interface só importa tipos do domínio.
 */
import { useEffect, useMemo, useState } from 'react';
import { lerInfoImagem, type ElementoNaSessao, type MencoesDoTexto } from '../../aplicacao';
import type { Bloco, InlineDeTitulo } from '../../dominio/modelo';

/** Ações que levam à aba Escrever e acontecem no editor. */
export type NovoElemento = 'tabela' | 'figura' | 'grafico' | 'planilha';

const GRUPOS: readonly { tipo: ElementoNaSessao['tipo']; nome: string }[] = [
  { tipo: 'tabela', nome: 'Tabelas e quadros' },
  { tipo: 'ilustracao', nome: 'Figuras' },
  { tipo: 'grafico', nome: 'Gráficos' },
  { tipo: 'equacao', nome: 'Equações' },
];

const plano = (t: readonly InlineDeTitulo[] | undefined): string => (t ?? []).map((i) => i.texto).join('').trim();

function contagem(x: ElementoNaSessao): string {
  if (x.remissivas === 0) return x.tipo === 'equacao' ? '' : 'sem remissiva no texto';
  const n = x.remissivas === 1 ? '1 remissiva' : `${x.remissivas} remissivas`;
  return x.semNumero > 0 ? `${n} (${x.semNumero} sem número)` : n;
}

export function ListaVisuais(p: {
  elementos: readonly ElementoNaSessao[];
  ativoId: string | null;
  somenteLeitura: boolean;
  aoEscolher: (x: ElementoNaSessao) => void;
  aoNovo: (tipo: NovoElemento) => void;
  aoMencoes: () => void;
}) {
  const grupos = GRUPOS.map((g) => ({ ...g, itens: p.elementos.filter((x) => x.tipo === g.tipo) })).filter((g) => g.itens.length > 0);
  return (
    <section className="elementos" aria-labelledby="titulo-visuais">
      <h2 id="titulo-visuais">Tabelas, figuras e equações</h2>
      {grupos.length === 0 ? (
        <p className="dica">Nenhum ainda. Crie um abaixo; ele entra no ponto do cursor do texto.</p>
      ) : (
        grupos.map((g) => (
          <div key={g.tipo}>
            <h3 className="elementos__grupo">{g.nome}</h3>
            <ul className="elementos__lista">
              {g.itens.map((x) => {
                const c = contagem(x);
                return (
                  <li key={x.id}>
                    <button type="button" className="elementos__item" aria-current={p.ativoId === x.id ? 'true' : undefined} onClick={() => p.aoEscolher(x)}>
                      <span>{x.descricao}</span>
                      {c !== '' && <span className="elementos__marca">{c}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
      <button type="button" className="btn-secundario" onClick={p.aoMencoes}>
        Menções no texto
      </button>
      {!p.somenteLeitura && (
        <div className="gerenciador__novos" role="group" aria-label="Novo elemento no cursor do texto">
          <button type="button" className="btn-secundario" onClick={() => p.aoNovo('tabela')}>Nova tabela ou quadro…</button>
          <button type="button" className="btn-secundario" onClick={() => p.aoNovo('planilha')} title="Tabelas e quadros de um arquivo .xlsx, escolhendo as abas e os intervalos">
            Importar planilha…
          </button>
          <button type="button" className="btn-secundario" onClick={() => p.aoNovo('figura')}>Nova figura…</button>
          <button type="button" className="btn-secundario" onClick={() => p.aoNovo('grafico')}>Novo gráfico…</button>
        </div>
      )}
    </section>
  );
}

/** Imagem da figura, pelos bytes do trabalho. */
function PreviaImagem({ bytes, alt }: { bytes: Uint8Array | null; alt: string }) {
  const info = useMemo(() => (bytes ? lerInfoImagem(bytes) : null), [bytes]);
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!bytes || !info) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: info.tipo }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [bytes, info]);
  return url ? <img className="gerenciador__imagem" src={url} alt={alt} /> : <p className="dica">Imagem não encontrada no trabalho.</p>;
}

const LINHAS_PREVIA = 8;

function Previa({ bloco, lerMidia, elementos }: { bloco: Bloco; lerMidia: (sha: string) => Uint8Array | null; elementos: readonly ElementoNaSessao[] }) {
  if (bloco.tipo === 'tabela') {
    const linhas = bloco.linhas.slice(0, LINHAS_PREVIA);
    return (
      <div className="gerenciador__previa">
        <table className="gerenciador__tabela">
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i}>
                {l.map((c, j) => {
                  const Celula = i < bloco.linhasCabecalho ? 'th' : 'td';
                  return (
                    <Celula key={j} colSpan={c.colunas} rowSpan={c.linhas}>
                      {plano(c.conteudo)}
                    </Celula>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {bloco.linhas.length > LINHAS_PREVIA && <p className="dica">Mais {bloco.linhas.length - LINHAS_PREVIA} linhas.</p>}
      </div>
    );
  }
  if (bloco.tipo === 'ilustracao') return <PreviaImagem bytes={lerMidia(bloco.midia)} alt={plano(bloco.titulo)} />;
  if (bloco.tipo === 'grafico') {
    const origem = elementos.find((e) => e.id === bloco.tabela);
    return <p className="dica">Gráfico gerado {origem ? `da ${origem.rotulo}` : 'de uma tabela que não existe mais'}.</p>;
  }
  if (bloco.tipo === 'equacao') return <p className="gerenciador__equacao">{plano(bloco.conteudo)}</p>;
  return null;
}

export function PainelElemento(p: {
  elemento: ElementoNaSessao;
  elementos: readonly ElementoNaSessao[];
  somenteLeitura: boolean;
  /** Seção aberta na aba Escrever, onde fica o cursor; `null` = nenhuma. */
  secaoDoCursor: string | null;
  lerMidia: (sha: string) => Uint8Array | null;
  aoIrAoTexto: () => void;
  aoEditar: () => void;
  aoRemissivaNoCursor: () => void;
  aoVoltar: () => void;
}) {
  const x = p.elemento;
  const b = x.bloco;
  const fonte = b && 'fonte' in b ? plano(b.fonte) : '';
  const nota = b && 'nota' in b ? plano(b.nota) : '';
  const titulo = b && 'titulo' in b ? plano(b.titulo) : '';
  return (
    <div className="gerenciador" aria-labelledby="titulo-gerenciador">
      <h2 id="titulo-gerenciador">{x.descricao}</h2>
      {b && <Previa bloco={b} lerMidia={p.lerMidia} elementos={p.elementos} />}
      <dl className="formulario__dados">
        <dt>Rótulo</dt>
        <dd>{x.tipo === 'equacao' ? `Equação ${x.rotulo}` : x.rotulo}</dd>
        {x.tipo !== 'equacao' && (
          <>
            <dt>Título</dt>
            <dd>{titulo === '' ? 'sem título (pendência)' : titulo}</dd>
            <dt>Fonte</dt>
            <dd>{fonte === '' ? 'sem fonte' : fonte}</dd>
          </>
        )}
        {nota !== '' && (
          <>
            <dt>Nota</dt>
            <dd>{nota}</dd>
          </>
        )}
        {b?.tipo === 'tabela' && b.origem && (
          <>
            <dt>Origem</dt>
            <dd>
              {b.origem.arquivo} › aba “{b.origem.aba}” › {b.origem.intervalo}
            </dd>
          </>
        )}
        <dt>Remissivas</dt>
        <dd>{x.remissivas === 0 ? 'nenhuma no texto' : contagem(x)}</dd>
      </dl>
      <div className="acoes">
        <button type="button" className="btn-secundario" onClick={p.aoIrAoTexto}>Ir ao texto</button>
        {!p.somenteLeitura && x.tipo !== 'equacao' && (
          <button type="button" className="btn-secundario" onClick={p.aoEditar}>Editar título, legenda e fonte…</button>
        )}
        {!p.somenteLeitura && (
          <button
            type="button"
            className="btn-principal"
            onClick={p.aoRemissivaNoCursor}
            disabled={p.secaoDoCursor === null}
            title={p.secaoDoCursor === null ? 'Abra uma seção na aba Escrever para ter um cursor' : 'Insere a remissiva no ponto do cursor da seção aberta'}
          >
            Inserir remissiva no cursor
          </button>
        )}
        <button type="button" className="btn-secundario" onClick={p.aoVoltar}>Menções no texto</button>
      </div>
      <p className="dica">A numeração acompanha a ordem do texto: inserir, excluir ou mover elementos renumera as remissivas ligadas.</p>
    </div>
  );
}

export function PainelMencoes(p: {
  mencoes: MencoesDoTexto;
  elementos: readonly ElementoNaSessao[];
  somenteLeitura: boolean;
  aoIr: (secao: string, no: string, trecho: string) => void;
  aoLigar: (secao: string, bloco: string, trecho: string) => void;
}) {
  const rotulo = new Map(p.elementos.map((e) => [e.id, e.rotulo]));
  const { escritas, semNumero } = p.mencoes;
  return (
    <div className="gerenciador" aria-labelledby="titulo-mencoes">
      <h2 id="titulo-mencoes">Menções no texto</h2>
      <section aria-labelledby="titulo-escritas">
        <h3 id="titulo-escritas" className="elementos__grupo">Escritas sem ligação</h3>
        {escritas.length === 0 ? (
          <p className="dica">Nenhuma. Toda menção a tabela, quadro, figura, apêndice ou anexo do texto corrido está ligada.</p>
        ) : (
          <>
            <p className="dica">Estes rótulos foram digitados e não mudam com a numeração. Ligue cada um ao elemento certo.</p>
            <ul className="elementos__lista">
              {escritas.map((m, i) => (
                <li key={`${m.bloco}-${i}`} className="gerenciador__mencao">
                  <span>
                    “{m.trecho}”{' '}
                    <span className="elementos__marca">{m.alvo !== null ? `hoje é ${rotulo.get(m.alvo)}` : 'nenhum elemento com esse número'}</span>
                  </span>
                  <button type="button" className="btn-secundario" onClick={() => p.aoIr(m.secao, m.bloco, m.trecho)}>Ir ao texto</button>
                  {!p.somenteLeitura && (
                    <button type="button" className="btn-principal" onClick={() => p.aoLigar(m.secao, m.bloco, m.trecho)} aria-label={`Ligar “${m.trecho}”`}>
                      Ligar…
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section aria-labelledby="titulo-sem-numero">
        <h3 id="titulo-sem-numero" className="elementos__grupo">Sem número (ligadas)</h3>
        {semNumero.length === 0 ? (
          <p className="dica">Nenhuma. Para escrever “o quadro a seguir” ligado ao quadro, use Inserir › Remissiva… e escolha “Sem número”.</p>
        ) : (
          <ul className="elementos__lista">
            {semNumero.map((r) => {
              const alvo = rotulo.get(r.remissiva.alvo);
              return (
                <li key={r.remissiva.id} className="gerenciador__mencao">
                  <span>
                    “{r.remissiva.texto}”{' '}
                    <span className={alvo ? 'elementos__marca' : 'elementos__marca elementos__marca--pendente'}>{alvo ? `ligada a ${alvo}` : 'quebrada: o elemento foi excluído'}</span>
                  </span>
                  <button type="button" className="btn-secundario" onClick={() => p.aoIr(r.secao, r.remissiva.id, '')}>Ir ao texto</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
