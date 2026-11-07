// Bibliografia na aba Escrever (M4-T06; RF-08): a lista das obras do trabalho, na ordem das referências, e o
// formulário da obra escolhida ou nova, com os campos do tipo e a prévia da referência como sairá no documento.
// Obra existente: cada alteração válida é gravada na hora (como os pré-textuais). Obra nova: só entra no trabalho pelo
// botão "Incluir obra", quando o formato a aceita. Texto sempre como texto (nunca HTML).
import { useId, useState, type KeyboardEvent } from 'react';
import {
  CAMPOS_DO_TIPO,
  previaDaObra,
  type CampoNumeroObra,
  type CampoObra,
  type CampoTextoObra,
  type ObraNaLista,
  type ResultadoObra,
} from '../../aplicacao';
import type { Autor, FuncaoResponsavel, InlineDeTitulo, Obra, TipoObra } from '../../dominio/modelo';
import { Icone } from '../Icones';

export const ROTULOS_TIPO_OBRA: Readonly<Record<TipoObra, string>> = {
  livro: 'Livro',
  capitulo: 'Capítulo de livro ou verbete',
  trabalhoAcademico: 'Monografia, dissertação ou tese',
  artigoPeriodico: 'Artigo de periódico',
  trabalhoEvento: 'Trabalho em evento',
  artigoJornal: 'Artigo de jornal',
  norma: 'Norma técnica',
  legislacao: 'Legislação',
  documentoOnline: 'Documento on-line',
};
/** Ordem do cadastro (D-M4-06). Tipo novo de versão futura não aparece aqui. */
const TIPOS: readonly TipoObra[] = ['livro', 'capitulo', 'trabalhoAcademico', 'artigoPeriodico', 'trabalhoEvento', 'artigoJornal', 'norma', 'legislacao', 'documentoOnline'];

const ROTULOS_FUNCAO: Readonly<Record<FuncaoResponsavel, string>> = { org: 'Organização (org.)', coord: 'Coordenação (coord.)', ed: 'Edição (ed.)', comp: 'Compilação (comp.)' };

type Rotulo = { rotulo: string; dica?: string; linhas?: number };
const ROTULOS_TEXTO: Readonly<Record<CampoTextoObra, Rotulo>> = {
  traducao: { rotulo: 'Tradução de', dica: 'Nome de quem traduziu.' },
  local: { rotulo: 'Local de publicação', dica: 'Cidade. Em branco, sai "[S. l.]".' },
  editora: { rotulo: 'Editora', dica: 'Em branco, sai "[s. n.]".' },
  paginas: { rotulo: 'Páginas', dica: 'Total ("191") ou intervalo da parte ("39-68").' },
  volume: { rotulo: 'Volume' },
  numero: { rotulo: 'Número' },
  periodico: { rotulo: 'Título do periódico ou jornal' },
  secao: { rotulo: 'Seção, caderno ou parte' },
  dataPublicacao: { rotulo: 'Data da publicação', dica: 'Como no documento: "jan./abr. 2014", "30 maio 2016".' },
  natureza: { rotulo: 'Natureza do trabalho', dica: 'Ex.: Dissertação (Mestrado em Letras).' },
  instituicao: { rotulo: 'Instituição' },
  programa: { rotulo: 'Programa, centro ou faculdade' },
  jurisdicao: { rotulo: 'Jurisdição', dica: 'País, estado ou município: "Brasil", "Tocantins".' },
  identificacao: { rotulo: 'Identificação', dica: 'Número da norma ("NBR 6023") ou, na legislação, o que vem antes do título ("Constituição (1988)").' },
  ementa: { rotulo: 'Ementa', linhas: 3 },
  publicacao: { rotulo: 'Publicado em', dica: 'Veículo oficial: "Diário Oficial [da] República Federativa do Brasil".' },
  url: { rotulo: 'Endereço eletrônico', dica: 'Começa com http:// ou https://.' },
  acesso: { rotulo: 'Data de acesso', dica: 'AAAA-MM-DD.' },
  doi: { rotulo: 'DOI' },
  colecao: { rotulo: 'Coleção ou série', dica: 'Sem os parênteses.' },
  tituloOriginal: { rotulo: 'Título original', dica: 'Na língua de origem.' },
  suplemento: { rotulo: 'Suplemento', dica: '"3" sai "Supl. 3".' },
  anoVeiculo: { rotulo: 'Ano do veículo', dica: '"138" sai "ano 138".' },
};
const ROTULOS_NUMERO: Readonly<Record<CampoNumeroObra, Rotulo>> = {
  edicao: { rotulo: 'Edição', dica: 'Número. A 1.ª não aparece na referência.' },
  ano: { rotulo: 'Ano' },
  folhas: { rotulo: 'Número de folhas' },
};

/** Rótulo do campo de um erro de validação (`obra.titulo`, `obra.autores[0].sobrenome`). */
function campoDoErro(caminho: string): string {
  const [, campo = ''] = /^obra\.([A-Za-z]+)/.exec(caminho) ?? [];
  if (campo === 'titulo') return 'Título';
  if (campo === 'subtitulo') return 'Subtítulo';
  if (campo === 'autores') return 'Autoria';
  if (campo === 'noTodo') return 'Obra no todo';
  if (campo === 'evento') return 'Evento';
  if (campo === 'anoIncerto') return 'Ano';
  return (ROTULOS_TEXTO as Record<string, Rotulo>)[campo]?.rotulo ?? (ROTULOS_NUMERO as Record<string, Rotulo>)[campo]?.rotulo ?? campo;
}

const textoDe = (t: readonly InlineDeTitulo[] | undefined) => (t ?? []).map((i) => i.texto).join('');
/** Troca o texto e mantém as marcas só se o texto não mudou (nome científico em itálico vindo de arquivo). */
const deTexto = (texto: string, atual: readonly InlineDeTitulo[] | undefined): InlineDeTitulo[] =>
  textoDe(atual) === texto ? [...(atual ?? [])] : texto === '' ? [] : [{ tipo: 'texto', texto }];

// ---------------------------------------------------------------------------------------------------------------

export interface PropsListaObras {
  obras: readonly ObraNaLista[];
  ativaId: string | null;
  somenteLeitura: boolean;
  anuncio: string | null;
  aoEscolher: (id: string) => void;
  aoNova: () => void;
  /** Abre a conferência da bibliografia (M4-T08). */
  aoConferir: () => void;
  aoHistorico: (sentido: 'desfazer' | 'refazer') => boolean;
}

export function ListaObras(p: PropsListaObras) {
  const base = useId();
  const aoTeclar = (ev: KeyboardEvent) => {
    if (!ev.ctrlKey || ev.altKey || p.somenteLeitura) return;
    const k = ev.key.toLowerCase();
    if (k === 'z' || k === 'y') {
      ev.preventDefault();
      p.aoHistorico(k === 'z' && !ev.shiftKey ? 'desfazer' : 'refazer');
    }
  };
  return (
    <nav className="elementos obras" aria-labelledby={`${base}-titulo`} onKeyDown={aoTeclar}>
      <h2 id={`${base}-titulo`}>Bibliografia</h2>
      {p.obras.length === 0 ? (
        <p className="dica">Nenhuma obra cadastrada.</p>
      ) : (
        <ul className="elementos__lista">
          {p.obras.map((o) => (
            <li key={o.obra.id}>
              <button type="button" className="elementos__item obras__item" aria-current={o.obra.id === p.ativaId ? 'true' : undefined} onClick={() => p.aoEscolher(o.obra.id)}>
                <span>{o.referencia === '' ? textoDe(o.obra.titulo) : o.referencia}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!p.somenteLeitura && (
        <button type="button" className="btn-secundario" onClick={p.aoNova}>
          Nova obra
        </button>
      )}
      <button type="button" className="btn-secundario" onClick={p.aoConferir}>
        Conferir citações e referências
      </button>
      <p className="dica" role="status">
        {p.anuncio}
      </p>
    </nav>
  );
}

// ---------------------------------------------------------------------------------------------------------------

export interface PropsFormularioObra {
  /** A obra como está no trabalho, ou o rascunho da nova. */
  obra: Obra;
  nova: boolean;
  somenteLeitura: boolean;
  aoIncluir: (obra: Obra) => ResultadoObra;
  aoAlterar: (obra: Obra) => ResultadoObra;
  aoExcluir: (id: string) => ResultadoObra;
  aoCancelar: () => void;
}

export function FormularioObra(p: PropsFormularioObra) {
  const base = useId();
  const so = p.somenteLeitura;
  const [rascunho, setRascunho] = useState<Obra>(p.obra);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const previa = previaDaObra(rascunho);
  const campos = new Set<CampoObra>(CAMPOS_DO_TIPO[rascunho.tipo] ?? []);
  const tem = (c: CampoObra) => campos.has(c);

  const mudar = (novo: Obra) => {
    setRascunho(novo);
    setMensagem(null);
    // Obra do trabalho: grava a cada alteração válida; a inválida espera aqui, com os campos assinalados.
    if (!p.nova && !so) p.aoAlterar(novo);
  };
  const texto = (c: CampoTextoObra) => {
    const r = ROTULOS_TEXTO[c];
    return <Campo key={c} rotulo={r.rotulo} dica={r.dica} linhas={r.linhas} valor={rascunho[c] ?? ''} somenteLeitura={so} aoMudar={(v) => mudar({ ...rascunho, [c]: v === '' ? undefined : v })} />;
  };
  const numero = (c: CampoNumeroObra) => {
    const r = ROTULOS_NUMERO[c];
    return (
      <Campo
        key={c}
        rotulo={r.rotulo}
        dica={r.dica}
        numerico
        valor={rascunho[c] === undefined ? '' : String(rascunho[c])}
        somenteLeitura={so}
        aoMudar={(v) => {
          const n = v.trim() === '' ? undefined : Number(v);
          mudar({ ...rascunho, [c]: n !== undefined && Number.isInteger(n) && n > 0 ? n : undefined });
        }}
      />
    );
  };

  return (
    <form className="formulario formulario--elemento" onSubmit={(ev) => ev.preventDefault()} aria-labelledby={`${base}-titulo`}>
      <div className="elemento__cab">
        <h2 className="escrever__numero" id={`${base}-titulo`}>
          {p.nova ? 'Nova obra' : 'Obra da bibliografia'}
        </h2>
        {!so && !p.nova && (
          <button
            type="button"
            className="btn-secundario"
            onClick={() => {
              const r = p.aoExcluir(p.obra.id);
              if (!r.ok) setMensagem(r.mensagem);
            }}
          >
            Excluir obra
          </button>
        )}
      </div>

      <div className="elemento__campo">
        <label htmlFor={`${base}-tipo`}>Tipo de obra</label>
        <select id={`${base}-tipo`} className="campo" value={rascunho.tipo} disabled={so} onChange={(ev) => mudar({ ...rascunho, tipo: ev.target.value as TipoObra })}>
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {ROTULOS_TIPO_OBRA[t]}
            </option>
          ))}
        </select>
      </div>

      {tem('jurisdicao') && texto('jurisdicao')}
      {tem('autores') && (
        <Autores
          legenda={rascunho.tipo === 'legislacao' ? 'Entidade responsável, se não houver jurisdição' : 'Autoria'}
          autores={rascunho.autores ?? []}
          funcao={tem('funcao') ? (rascunho.funcao ?? null) : undefined}
          somenteLeitura={so}
          aoMudar={(autores, funcao) => mudar({ ...rascunho, autores: autores.length > 0 ? autores : undefined, funcao: funcao ?? undefined })}
        />
      )}
      {tem('identificacao') && texto('identificacao')}
      <Campo rotulo="Título" dica={tem('autores') ? 'Sem autoria, a referência entra pelo título.' : undefined} valor={textoDe(rascunho.titulo)} somenteLeitura={so} aoMudar={(v) => mudar({ ...rascunho, titulo: deTexto(v, rascunho.titulo) })} />
      {tem('subtitulo') && <Campo rotulo="Subtítulo" valor={textoDe(rascunho.subtitulo)} somenteLeitura={so} aoMudar={(v) => mudar({ ...rascunho, subtitulo: v === '' ? undefined : deTexto(v, rascunho.subtitulo) })} />}
      {tem('noTodo') && rascunho.tipo === 'capitulo' && (
        <fieldset className="elemento__grupo">
          <legend>Livro de que faz parte</legend>
          <Autores
            legenda="Autoria ou responsável pelo livro"
            autores={rascunho.noTodo?.autores ?? []}
            funcao={rascunho.noTodo?.funcao ?? null}
            somenteLeitura={so}
            aoMudar={(autores, funcao) => mudar({ ...rascunho, noTodo: { ...rascunho.noTodo, titulo: rascunho.noTodo?.titulo ?? [], autores: autores.length > 0 ? autores : undefined, funcao: funcao ?? undefined } })}
          />
          <Campo rotulo="Título do livro" dica="Sem autoria, entra pelo título (dicionários, enciclopédias)." valor={textoDe(rascunho.noTodo?.titulo)} somenteLeitura={so} aoMudar={(v) => mudar({ ...rascunho, noTodo: { ...rascunho.noTodo, titulo: deTexto(v, rascunho.noTodo?.titulo) } })} />
          <Campo rotulo="Subtítulo do livro" valor={textoDe(rascunho.noTodo?.subtitulo)} somenteLeitura={so} aoMudar={(v) => mudar({ ...rascunho, noTodo: { ...rascunho.noTodo, titulo: rascunho.noTodo?.titulo ?? [], subtitulo: v === '' ? undefined : deTexto(v, rascunho.noTodo?.subtitulo) } })} />
        </fieldset>
      )}
      {tem('evento') && (
        <fieldset className="elemento__grupo">
          <legend>Evento</legend>
          <Campo rotulo="Nome do evento" valor={rascunho.evento?.nome ?? ''} somenteLeitura={so} aoMudar={(nome) => mudar({ ...rascunho, evento: { ...rascunho.evento, nome } })} />
          <Campo rotulo="Número do evento" numerico valor={rascunho.evento?.numero === undefined ? '' : String(rascunho.evento.numero)} somenteLeitura={so} aoMudar={(v) => mudar({ ...rascunho, evento: { nome: '', ...rascunho.evento, numero: inteiro(v) } })} />
          <Campo rotulo="Ano do evento" numerico valor={rascunho.evento?.ano === undefined ? '' : String(rascunho.evento.ano)} somenteLeitura={so} aoMudar={(v) => mudar({ ...rascunho, evento: { nome: '', ...rascunho.evento, ano: inteiro(v) } })} />
          <Campo rotulo="Local do evento" valor={rascunho.evento?.local ?? ''} somenteLeitura={so} aoMudar={(local) => mudar({ ...rascunho, evento: { nome: '', ...rascunho.evento, local } })} />
          <Campo rotulo="Título dos anais" dica={'Em branco, sai "Anais".'} valor={textoDe(rascunho.noTodo?.titulo)} somenteLeitura={so} aoMudar={(v) => mudar({ ...rascunho, noTodo: v === '' ? undefined : { titulo: deTexto(v, rascunho.noTodo?.titulo) } })} />
        </fieldset>
      )}
      {CAMPOS_DO_TIPO[rascunho.tipo]
        .filter((c): c is CampoTextoObra | CampoNumeroObra => c in ROTULOS_TEXTO || c in ROTULOS_NUMERO)
        .filter((c) => c !== 'jurisdicao' && c !== 'identificacao')
        .map((c) => (c in ROTULOS_NUMERO ? numero(c as CampoNumeroObra) : texto(c as CampoTextoObra)))}
      {tem('anoIncerto') && (
        <div className="elemento__campo">
          <label htmlFor={`${base}-incerto`}>O ano está impresso na obra?</label>
          <select
            id={`${base}-incerto`}
            className="campo"
            value={rascunho.anoIncerto ?? ''}
            disabled={so || rascunho.ano === undefined}
            onChange={(ev) => mudar({ ...rascunho, anoIncerto: ev.target.value === '' ? undefined : (ev.target.value as 'provavel' | 'naoImpresso') })}
          >
            <option value="">Sim</option>
            <option value="naoImpresso">Não, mas é certo: [2016]</option>
            <option value="provavel">Não, é provável: [2016?]</option>
          </select>
        </div>
      )}
      {tem('ebook') && (
        <label className="elemento__marcar">
          <input type="checkbox" checked={rascunho.ebook === true} disabled={so} onChange={(ev) => mudar({ ...rascunho, ebook: ev.target.checked ? true : undefined })} />
          Livro em formato e-book
        </label>
      )}

      <section className="obra__previa" aria-labelledby={`${base}-previa`}>
        <h3 id={`${base}-previa`}>Como sai na lista de referências</h3>
        <p className="obra__referencia">
          {previa.trechos.length === 0 ? (
            <span className="dica">Preencha o título para ver a referência.</span>
          ) : (
            previa.trechos.map((x, i) => {
              let el = <>{x.texto}</>;
              if (x.marcas.includes('italico')) el = <em>{el}</em>;
              if (x.marcas.includes('negrito')) el = <strong>{el}</strong>;
              return <span key={i}>{el}</span>;
            })
          )}
        </p>
      </section>

      {previa.erros.length > 0 && (
        <ul className="avisos" aria-label="O que impede gravar a obra">
          {previa.erros.map((e) => (
            <li key={`${e.caminho}-${e.mensagem}`} className="aviso aviso--erro">
              <Icone nome="erro" />
              <span className="aviso__texto">
                {campoDoErro(e.caminho)}: {e.mensagem}
              </span>
            </li>
          ))}
        </ul>
      )}
      {previa.avisos.length > 0 && (
        <ul className="avisos" aria-label="Elementos que faltam na referência">
          {previa.avisos.map((a) => (
            <li key={`${a.codigo}-${a.mensagem}`} className="aviso">
              <Icone nome="alerta" />
              <span className="aviso__texto">
                {a.mensagem} <span className="dica">({a.rn})</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {p.nova && !so && (
        <div className="acoes">
          <button
            type="button"
            className="btn-principal"
            disabled={previa.erros.length > 0}
            onClick={() => {
              const r = p.aoIncluir(rascunho);
              if (!r.ok) setMensagem(r.mensagem);
            }}
          >
            Incluir obra
          </button>
          <button type="button" className="btn-secundario" onClick={p.aoCancelar}>
            Cancelar
          </button>
        </div>
      )}
      {!p.nova && !so && previa.erros.length > 0 && <p className="dica">As alterações desta obra só são gravadas quando não houver campo assinalado.</p>}
      <p className="dica" role="alert">
        {mensagem}
      </p>
    </form>
  );
}

function inteiro(v: string): number | undefined {
  const n = Number(v);
  return v.trim() !== '' && Number.isInteger(n) && n > 0 ? n : undefined;
}

function Campo(p: { rotulo: string; dica?: string | undefined; linhas?: number | undefined; numerico?: boolean; valor: string; somenteLeitura: boolean; aoMudar: (v: string) => void }) {
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
      {p.linhas ? (
        <textarea {...comuns} rows={p.linhas} onChange={(ev) => p.aoMudar(ev.target.value)} />
      ) : (
        <input {...comuns} type="text" inputMode={p.numerico ? 'numeric' : undefined} onChange={(ev) => p.aoMudar(ev.target.value)} />
      )}
      {p.dica && (
        <p className="dica" id={`${id}-dica`}>
          {p.dica}
        </p>
      )}
    </div>
  );
}

/** Autores pessoa ou entidade, na ordem da obra; a função (org., coord.) vale para todos (RN-186). */
function Autores(p: { legenda: string; autores: readonly Autor[]; funcao: FuncaoResponsavel | null | undefined; somenteLeitura: boolean; aoMudar: (a: Autor[], f: FuncaoResponsavel | null) => void }) {
  const base = useId();
  const funcao = p.funcao ?? null;
  const mudar = (i: number, a: Autor) => p.aoMudar(p.autores.map((x, j) => (j === i ? a : x)), funcao);
  return (
    <fieldset className="elemento__grupo">
      <legend>{p.legenda}</legend>
      {p.autores.map((a, i) => (
        <fieldset key={i} className="elemento__grupo">
          <legend>
            {a.tipo === 'pessoa' ? 'Pessoa' : 'Entidade'} {i + 1}
          </legend>
          <div className="elemento__campo">
            <label htmlFor={`${base}-${i}-tipo`}>Autoria de</label>
            <select
              id={`${base}-${i}-tipo`}
              className="campo"
              value={a.tipo}
              disabled={p.somenteLeitura}
              onChange={(ev) => mudar(i, ev.target.value === 'entidade' ? { tipo: 'entidade', nome: '' } : { tipo: 'pessoa', sobrenome: '' })}
            >
              <option value="pessoa">Pessoa</option>
              <option value="entidade">Entidade (instituição, órgão, empresa)</option>
            </select>
          </div>
          {a.tipo === 'pessoa' ? (
            <>
              <Campo rotulo="Sobrenome" dica={'Com Filho, Júnior, Neto ou Sobrinho junto: "Silva Neto".'} valor={a.sobrenome} somenteLeitura={p.somenteLeitura} aoMudar={(sobrenome) => mudar(i, { ...a, sobrenome })} />
              <Campo rotulo="Prenomes" dica="Por extenso ou abreviados, como na obra." valor={a.prenomes ?? ''} somenteLeitura={p.somenteLeitura} aoMudar={(prenomes) => mudar(i, { ...a, prenomes })} />
            </>
          ) : (
            <Campo rotulo="Nome da entidade" dica="Por extenso." valor={a.nome} somenteLeitura={p.somenteLeitura} aoMudar={(nome) => mudar(i, { tipo: 'entidade', nome })} />
          )}
          {!p.somenteLeitura && (
            <button type="button" className="btn-secundario" onClick={() => p.aoMudar(p.autores.filter((_, j) => j !== i), funcao)}>
              Retirar {a.tipo === 'pessoa' ? 'pessoa' : 'entidade'} {i + 1}
            </button>
          )}
        </fieldset>
      ))}
      {!p.somenteLeitura && (
        <button type="button" className="btn-secundario" onClick={() => p.aoMudar([...p.autores, { tipo: 'pessoa', sobrenome: '' }], funcao)}>
          Acrescentar autoria
        </button>
      )}
      {p.funcao !== undefined && p.autores.length > 0 && (
        <div className="elemento__campo">
          <label htmlFor={`${base}-funcao`}>Responsabilidade pela obra</label>
          <select id={`${base}-funcao`} className="campo" value={funcao ?? ''} disabled={p.somenteLeitura} onChange={(ev) => p.aoMudar([...p.autores], ev.target.value === '' ? null : (ev.target.value as FuncaoResponsavel))}>
            <option value="">Autoria</option>
            {(Object.keys(ROTULOS_FUNCAO) as FuncaoResponsavel[]).map((f) => (
              <option key={f} value={f}>
                {ROTULOS_FUNCAO[f]}
              </option>
            ))}
          </select>
        </div>
      )}
    </fieldset>
  );
}
