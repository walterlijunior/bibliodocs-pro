// Elementos pré-textuais na aba Escrever (M2-T08; RF-04): a lista dos elementos do trabalho, incluir e retirar, e o
// formulário do elemento escolhido, com as pendências dele. Texto simples nos campos: negrito e itálico ficam para quando
// o resumo e os agradecimentos usarem o editor de seção. Texto sempre como texto (nunca HTML).
import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { palavrasChaveDoTexto, type AlteracaoDados, type CampoTextoDados, type CamposElemento, type PendenciaPreTextual, type ResumoElemento } from '../../aplicacao';
import type { ElementoPreTextual, ElementoPreTextualId, IdiomaResumo, MembroBanca, Metadados, PessoaTitulada } from '../../dominio/modelo';
import { Icone } from '../Icones';

export const ROTULOS_ELEMENTO: Readonly<Record<ElementoPreTextualId, string>> = {
  capa: 'Capa',
  folhaRosto: 'Folha de rosto',
  fichaCatalografica: 'Ficha catalográfica',
  errata: 'Errata',
  folhaAprovacao: 'Folha de aprovação',
  dedicatoria: 'Dedicatória',
  agradecimentos: 'Agradecimentos',
  epigrafe: 'Epígrafe',
  resumo: 'Resumo',
  abstract: 'Resumo em língua estrangeira',
  listaIlustracoes: 'Lista de ilustrações',
  listaTabelas: 'Lista de tabelas',
  listaSiglas: 'Lista de abreviaturas e siglas',
  listaSimbolos: 'Lista de símbolos',
  sumario: 'Sumário',
};

const SUGESTAO = 'Sugestão do modelo UFT, não exigida pelo Manual.';

export interface PropsListaElementos {
  elementos: readonly ResumoElemento[];
  ausentes: readonly ElementoPreTextualId[];
  /** Pendências de elementos que não estão no trabalho (obrigatório ausente). */
  pendenciasGerais: readonly PendenciaPreTextual[];
  ativoId: string | null;
  somenteLeitura: boolean;
  anuncio: string | null;
  aoEscolher: (id: string) => void;
  aoIncluir: (tipo: ElementoPreTextualId) => void;
  aoHistorico: (sentido: 'desfazer' | 'refazer') => boolean;
}

export function ListaElementos(p: PropsListaElementos) {
  const base = useId();
  const [incluir, setIncluir] = useState<ElementoPreTextualId | ''>('');
  // Ctrl+Z na lista segue a ordem única: é daqui que o elemento retirado volta.
  const aoTeclar = (ev: KeyboardEvent) => {
    if (!ev.ctrlKey || ev.altKey || p.somenteLeitura) return;
    const k = ev.key.toLowerCase();
    if (k === 'z' || k === 'y') {
      ev.preventDefault();
      p.aoHistorico(k === 'z' && !ev.shiftKey ? 'desfazer' : 'refazer');
    }
  };
  return (
    <nav className="elementos" aria-labelledby={`${base}-titulo`} onKeyDown={aoTeclar}>
      <h2 id={`${base}-titulo`}>Elementos pré-textuais</h2>
      <ul className="elementos__lista">
        {p.elementos.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className="elementos__item"
              aria-current={e.id === p.ativoId ? 'true' : undefined}
              aria-describedby={e.sugerido ? `${base}-sugestao` : undefined}
              onClick={() => p.aoEscolher(e.id)}
            >
              <span>{ROTULOS_ELEMENTO[e.tipo]}</span>
              {e.sugerido && <span className="elementos__marca">sugestão</span>}
              {e.pendencias > 0 && <span className="elementos__marca elementos__marca--pendente">{e.pendencias === 1 ? '1 pendência' : `${e.pendencias} pendências`}</span>}
            </button>
          </li>
        ))}
      </ul>
      <p className="dica" id={`${base}-sugestao`} hidden={!p.elementos.some((e) => e.sugerido)}>
        {SUGESTAO}
      </p>
      <ListaPendencias itens={p.pendenciasGerais} rotulo="Pendências do trabalho" />
      {!p.somenteLeitura && p.ausentes.length > 0 && (
        <div className="elementos__incluir">
          <label htmlFor={`${base}-incluir`}>Incluir elemento</label>
          <select id={`${base}-incluir`} className="campo" value={incluir} onChange={(ev) => setIncluir(ev.target.value as ElementoPreTextualId | '')}>
            <option value="">Escolha…</option>
            {p.ausentes.map((t) => (
              <option key={t} value={t}>
                {ROTULOS_ELEMENTO[t]}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-secundario"
            disabled={incluir === '' || !p.ausentes.includes(incluir)}
            onClick={() => {
              if (incluir === '') return;
              p.aoIncluir(incluir);
              setIncluir('');
            }}
          >
            Incluir
          </button>
        </div>
      )}
      <p className="dica" role="status">
        {p.anuncio}
      </p>
    </nav>
  );
}

function ListaPendencias({ itens, rotulo }: { itens: readonly PendenciaPreTextual[]; rotulo: string }) {
  if (itens.length === 0) return null;
  return (
    <ul className="avisos" aria-label={rotulo}>
      {itens.map((x) => (
        <li key={`${x.rn}-${x.mensagem}`} className={x.nivel === 'pendencia' ? 'aviso aviso--erro' : 'aviso'}>
          <Icone nome={x.nivel === 'pendencia' ? 'erro' : 'alerta'} />
          <span className="aviso__texto">
            {x.mensagem} <span className="dica">({x.rn})</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface PropsFormularioElemento {
  elemento: ElementoPreTextual;
  dados: Metadados;
  subtitulo: string;
  sugerido: boolean;
  /** O projeto de pesquisa tem coordenador(a) no lugar de orientador(a), como no modelo UFT. */
  rotuloOrientador: string;
  pendencias: readonly PendenciaPreTextual[];
  somenteLeitura: boolean;
  aoAlterarDados: (a: AlteracaoDados) => void;
  aoAlterarSubtitulo: (texto: string) => void;
  aoAlterarElemento: (id: string, campos: CamposElemento) => void;
  aoRetirar: (id: string) => void;
}

export function FormularioElemento(p: PropsFormularioElemento) {
  const e = p.elemento;
  const so = p.somenteLeitura;
  const base = useId();
  const dado = (campo: CampoTextoDados, rotulo: string, extra?: { dica?: string; linhas?: number }) => (
    <Campo rotulo={rotulo} dica={extra?.dica} linhas={extra?.linhas} valor={p.dados[campo] ?? ''} somenteLeitura={so} aoMudar={(valor) => p.aoAlterarDados({ campo, valor })} />
  );
  const pessoa = (campo: 'orientador' | 'coorientador', rotulo: string) => (
    <Pessoa rotulo={rotulo} valor={p.dados[campo] ?? {}} somenteLeitura={so} aoMudar={(valor) => p.aoAlterarDados({ campo, valor })} />
  );
  const texto = (rotulo: string, dica?: string, linhas = 6) =>
    'texto' in e || CAMPO_TEXTO.has(e.tipo) ? (
      <Campo rotulo={rotulo} dica={dica} linhas={linhas} valor={(e as { texto?: string }).texto ?? ''} somenteLeitura={so} aoMudar={(v) => p.aoAlterarElemento(e.id, { texto: v })} />
    ) : null;

  return (
    <form className="formulario formulario--elemento" onSubmit={(ev) => ev.preventDefault()} aria-labelledby={`${base}-titulo`}>
      <div className="elemento__cab">
        <h2 className="escrever__numero" id={`${base}-titulo`}>
          {ROTULOS_ELEMENTO[e.tipo]}
        </h2>
        {!so && (
          <button type="button" className="btn-secundario" onClick={() => p.aoRetirar(e.id)}>
            Retirar do trabalho
          </button>
        )}
      </div>
      {p.sugerido && <p className="dica">{SUGESTAO}</p>}

      {e.tipo === 'capa' && (
        <>
          {dado('instituicao', 'Instituição')}
          {dado('campus', 'Câmpus')}
          {dado('curso', 'Curso ou programa')}
          {dado('autoria', 'Autoria')}
          <Campo rotulo="Subtítulo" dica="Se houver." valor={p.subtitulo} somenteLeitura={so} aoMudar={p.aoAlterarSubtitulo} />
          {dado('volume', 'Número do volume', { dica: 'Só se houver mais de um.' })}
          {dado('local', 'Local')}
          {dado('ano', 'Ano do depósito')}
        </>
      )}
      {e.tipo === 'folhaRosto' && (
        <>
          {dado('autoria', 'Autoria')}
          {dado('natureza', 'Natureza do trabalho', { linhas: 3, dica: 'Tipo do trabalho, objetivo (grau pretendido) e instituição.' })}
          {dado('areaConcentracao', 'Área de concentração')}
          {pessoa('orientador', p.rotuloOrientador)}
          {pessoa('coorientador', `Co${p.rotuloOrientador.toLowerCase()}, se houver`)}
          {dado('local', 'Local')}
          {dado('ano', 'Ano do depósito')}
          <label className="elemento__marcar">
            <input type="checkbox" checked={p.dados.bolsista === true} disabled={so} onChange={(ev) => p.aoAlterarDados({ campo: 'bolsista', valor: ev.target.checked })} />
            O autor é bolsista de alguma instituição (os agradecimentos passam a ser obrigatórios)
          </label>
        </>
      )}
      {e.tipo === 'fichaCatalografica' && texto('Texto da ficha', 'A ficha é gerada no sistema da UFT: sistemas.uft.edu.br/ficha/. Cole aqui o texto gerado.', 10)}
      {e.tipo === 'errata' && texto('Texto da errata', 'Referência do trabalho e correções.')}
      {e.tipo === 'dedicatoria' && texto('Texto da dedicatória', 'Texto curto; aparece sem título.', 3)}
      {e.tipo === 'agradecimentos' && texto('Texto dos agradecimentos')}
      {e.tipo === 'epigrafe' && texto('Texto da epígrafe', 'Aparece sem título.', 3)}
      {e.tipo === 'folhaAprovacao' && (
        <>
          <p className="dica">Autoria, título e natureza vêm da capa e da folha de rosto.</p>
          <Campo rotulo="Data de aprovação" valor={e.dataAprovacao ?? ''} somenteLeitura={so} aoMudar={(v) => p.aoAlterarElemento(e.id, { dataAprovacao: v })} />
          <Banca banca={e.banca ?? []} somenteLeitura={so} aoMudar={(banca) => p.aoAlterarElemento(e.id, { banca })} />
        </>
      )}
      {e.tipo === 'resumo' && (
        <>
          {texto('Texto do resumo', undefined, 12)}
          <PalavrasChave rotulo="Palavras-chave" chave={e.id} valor={e.palavrasChave ?? []} somenteLeitura={so} aoMudar={(palavrasChave) => p.aoAlterarElemento(e.id, { palavrasChave })} />
        </>
      )}
      {e.tipo === 'abstract' && (
        <>
          <Idioma valor={e.idioma ?? 'en'} somenteLeitura={so} aoMudar={(idioma) => p.aoAlterarElemento(e.id, { idioma })} />
          {texto('Texto do resumo em língua estrangeira', undefined, 12)}
          <PalavrasChave rotulo="Palavras-chave na língua escolhida" chave={e.id} valor={e.palavrasChave ?? []} somenteLeitura={so} aoMudar={(palavrasChave) => p.aoAlterarElemento(e.id, { palavrasChave })} />
        </>
      )}
      {GERADOS.has(e.tipo) && <p className="dica">Este elemento é gerado a partir do texto do trabalho. A geração chega numa próxima versão.</p>}

      <ListaPendencias itens={p.pendencias} rotulo={`Pendências: ${ROTULOS_ELEMENTO[e.tipo]}`} />
    </form>
  );
}

const CAMPO_TEXTO: ReadonlySet<ElementoPreTextualId> = new Set(['fichaCatalografica', 'errata', 'dedicatoria', 'agradecimentos', 'epigrafe', 'resumo', 'abstract']);
const GERADOS: ReadonlySet<ElementoPreTextualId> = new Set(['listaIlustracoes', 'listaTabelas', 'listaSiglas', 'listaSimbolos', 'sumario']);

function Campo(p: { rotulo: string; dica?: string | undefined; linhas?: number | undefined; valor: string; somenteLeitura: boolean; aoMudar: (v: string) => void }) {
  const id = useId();
  const comuns = {
    id,
    className: 'campo',
    value: p.valor,
    readOnly: p.somenteLeitura,
    spellCheck: false,
    'aria-describedby': p.dica ? `${id}-dica` : undefined,
  };
  return (
    <div className="elemento__campo">
      <label htmlFor={id}>{p.rotulo}</label>
      {p.linhas ? <textarea {...comuns} rows={p.linhas} onChange={(ev) => p.aoMudar(ev.target.value)} /> : <input {...comuns} type="text" onChange={(ev) => p.aoMudar(ev.target.value)} />}
      {p.dica && (
        <p className="dica" id={`${id}-dica`}>
          {p.dica}
        </p>
      )}
    </div>
  );
}

function Pessoa(p: { rotulo: string; valor: PessoaTitulada; somenteLeitura: boolean; aoMudar: (v: PessoaTitulada) => void }) {
  return (
    <fieldset className="elemento__grupo">
      <legend>{p.rotulo}</legend>
      <Campo rotulo="Titulação" dica="Ex.: Prof. Dr." valor={p.valor.titulacao ?? ''} somenteLeitura={p.somenteLeitura} aoMudar={(titulacao) => p.aoMudar({ ...p.valor, titulacao })} />
      <Campo rotulo="Nome" valor={p.valor.nome ?? ''} somenteLeitura={p.somenteLeitura} aoMudar={(nome) => p.aoMudar({ ...p.valor, nome })} />
    </fieldset>
  );
}

function Banca(p: { banca: readonly MembroBanca[]; somenteLeitura: boolean; aoMudar: (b: MembroBanca[]) => void }) {
  const mudar = (i: number, m: MembroBanca) => p.aoMudar(p.banca.map((x, j) => (j === i ? m : x)));
  return (
    <fieldset className="elemento__grupo">
      <legend>Banca</legend>
      {p.banca.map((m, i) => (
        <fieldset key={i} className="elemento__grupo">
          <legend>Membro {i + 1}</legend>
          <Campo rotulo="Titulação" valor={m.titulacao ?? ''} somenteLeitura={p.somenteLeitura} aoMudar={(titulacao) => mudar(i, { ...m, titulacao })} />
          <Campo rotulo="Nome" valor={m.nome ?? ''} somenteLeitura={p.somenteLeitura} aoMudar={(nome) => mudar(i, { ...m, nome })} />
          <Campo rotulo="Instituição" valor={m.instituicao ?? ''} somenteLeitura={p.somenteLeitura} aoMudar={(instituicao) => mudar(i, { ...m, instituicao })} />
          {!p.somenteLeitura && (
            <button type="button" className="btn-secundario" onClick={() => p.aoMudar(p.banca.filter((_, j) => j !== i))}>
              Retirar membro {i + 1}
            </button>
          )}
        </fieldset>
      ))}
      {!p.somenteLeitura && (
        <button type="button" className="btn-secundario" onClick={() => p.aoMudar([...p.banca, {}])}>
          Acrescentar membro
        </button>
      )}
    </fieldset>
  );
}

function Idioma(p: { valor: IdiomaResumo; somenteLeitura: boolean; aoMudar: (v: IdiomaResumo) => void }) {
  const id = useId();
  return (
    <div className="elemento__campo">
      <label htmlFor={id}>Língua (RN-157)</label>
      <select id={id} className="campo" value={p.valor} disabled={p.somenteLeitura} onChange={(ev) => p.aoMudar(ev.target.value as IdiomaResumo)}>
        <option value="en">Inglês (Abstract)</option>
        <option value="es">Espanhol (Resumen)</option>
        <option value="fr">Francês (Résumé)</option>
      </select>
    </div>
  );
}

const paraTexto = (v: readonly string[]) => v.join('; ');

/**
 * O autor digita separando por ponto e vírgula. O texto cru fica aqui enquanto ele digita ("a; " viraria "a" e o
 * ponto e vírgula sumiria); o modelo guarda só a lista, e o texto é refeito se a lista mudar por fora (desfazer).
 */
function PalavrasChave(p: { rotulo: string; chave: string; valor: readonly string[]; somenteLeitura: boolean; aoMudar: (v: string[]) => void }) {
  const [cru, setCru] = useState(() => paraTexto(p.valor));
  const externo = paraTexto(p.valor);
  useEffect(() => {
    setCru((c) => (paraTexto(palavrasChaveDoTexto(c)) === externo ? c : externo));
  }, [externo, p.chave]);
  return (
    <Campo
      rotulo={p.rotulo}
      dica="Separe com ponto e vírgula. O ponto final de cada uma é posto na formatação."
      valor={cru}
      somenteLeitura={p.somenteLeitura}
      aoMudar={(t) => {
        setCru(t);
        p.aoMudar(palavrasChaveDoTexto(t));
      }}
    />
  );
}
