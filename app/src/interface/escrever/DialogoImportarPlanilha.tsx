/**
 * "Importar planilha" (Etapa 4 da especificação de atualização: importar por aba). Janela dedicada e espaçosa:
 *
 * 1. o autor escolhe o .xlsx; as abas aparecem pelo nome, com os elementos que cada uma parece ter;
 * 2. marca uma ou várias abas (as auxiliares, como "SIGLAS" e "Referencias", ficam desmarcadas se ele quiser);
 * 3. para cada aba marcada, a grade mostra a planilha; cada intervalo sugerido vira um elemento, e o autor pode
 *    escolher outro intervalo arrastando na grade ou digitando ("A1:C11") e acrescentá-lo como mais um elemento;
 * 4. cada elemento tem espécie (tabela ou quadro), título, fonte, as opções da conversão e a prévia, com o relatório
 *    do que muda na aparência;
 * 5. "Inserir" põe todos no cursor do texto, numa só ação (Ctrl+Z desfaz a importação inteira), com a origem
 *    (arquivo, aba e intervalo) guardada em cada um. O arquivo de origem só é lido.
 *
 * Fechar ou cancelar não insere nada; o foco volta ao editor, no mesmo ponto (Etapa 4: cancelar sem perder a posição).
 * Texto sempre como texto (nunca HTML).
 */
import { useEffect, useId, useMemo, useRef, useState, type PointerEvent as EventoPonteiro } from 'react';
import {
  aplicarPlanilha,
  converterPlanilha,
  lerIntervalo,
  lerPastaXlsx,
  letrasColuna,
  LIMITE_BYTES_XLSX,
  OPCOES_INTERVALO_PADRAO,
  opcoesSugeridas,
  planilhaDoIntervalo,
  rascunhoNovo,
  sugerirIntervalos,
  textoIntervalo,
  validarTabela,
  type AbaXlsx,
  type DadosTabela,
  type IntervaloXlsx,
  type OpcoesIntervalo,
  type OpcoesPlanilha,
  type PastaXlsx,
  type SinalParaVazio,
} from '../../aplicacao';
import { aoFecharDialogo } from '../casca/dialogo';
import { Icone } from '../Icones';

export interface PropsDialogoImportarPlanilha {
  aoInserir: (lista: DadosTabela[]) => void;
  aoFechar: () => void;
}

interface Elemento {
  chave: number;
  aba: string;
  intervalo: string;
  rotulo: string;
  especie: 'tabela' | 'quadro';
  titulo: string;
  fonte: string;
  intervaloOpcoes: OpcoesIntervalo;
  /** Opções da conversão escolhidas pelo autor; ausente = as sugeridas pelos dados. */
  opcoes?: OpcoesPlanilha;
}

/** Linhas e colunas mostradas na grade da aba; além disso, o intervalo se digita. */
const MAX_LINHAS_GRADE = 200;
const MAX_COLUNAS_GRADE = 30;
const LINHAS_NA_PREVIA = 12;

const VAZIOS: readonly { valor: SinalParaVazio; rotulo: string }[] = [
  { valor: '', rotulo: 'Deixar vazias' },
  { valor: '...', rotulo: '... (dado não disponível)' },
  { valor: '–', rotulo: '– (dado igual a zero)' },
  { valor: '..', rotulo: '.. (não se aplica)' },
  { valor: 'X', rotulo: 'X (dado omitido)' },
];

/** Tabela quando a maioria das células com valor do intervalo é número; senão, quadro (conteúdo em texto). */
function especieSugerida(aba: AbaXlsx, i: IntervaloXlsx): 'tabela' | 'quadro' {
  let numeros = 0;
  let total = 0;
  for (const c of aba.celulas) {
    if (c.l < i.l1 || c.l > i.l2 || c.c < i.c1 || c.c > i.c2 || c.texto.trim() === '') continue;
    total++;
    if (c.tipo === 'numero') numeros++;
  }
  return total > 0 && numeros * 2 >= total ? 'tabela' : 'quadro';
}

let proximaChave = 1;

function elementosDaAba(aba: AbaXlsx): Elemento[] {
  return sugerirIntervalos(aba).map((s) => ({
    chave: proximaChave++,
    aba: aba.nome,
    intervalo: textoIntervalo(s.intervalo),
    rotulo: s.rotulo,
    especie: especieSugerida(aba, s.intervalo),
    titulo: '',
    fonte: '',
    intervaloOpcoes: OPCOES_INTERVALO_PADRAO,
  }));
}

/** Prévia de um elemento: o intervalo convertido como a janela da tabela converteria a colagem. */
function previaDe(aba: AbaXlsx, e: Elemento) {
  const i = lerIntervalo(e.intervalo);
  if (!i) return null;
  const p = planilhaDoIntervalo(aba, i, e.intervaloOpcoes);
  if (p.lida.linhas.length === 0) return { p, opcoes: null, conv: null };
  const opcoes = e.opcoes ?? opcoesSugeridas(p.lida);
  return { p, opcoes, conv: converterPlanilha(p.lida, e.especie, opcoes) };
}

// ---------------------------------------------------------------------------------------------------------
// Grade da aba, com seleção do intervalo pelo mouse
// ---------------------------------------------------------------------------------------------------------

function GradeAba(p: { aba: AbaXlsx; selecao: IntervaloXlsx | null; marcados: readonly IntervaloXlsx[]; aoSelecionar: (i: IntervaloXlsx) => void }) {
  const { aba } = p;
  const area = aba.preenchida;
  const nLinhas = Math.min(MAX_LINHAS_GRADE, (area?.l2 ?? 0) + 2);
  const nColunas = Math.min(MAX_COLUNAS_GRADE, (area?.c2 ?? 0) + 2);
  const textos = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of aba.celulas) if (c.l < nLinhas && c.c < nColunas) m.set(`${c.l},${c.c}`, c.texto);
    return m;
  }, [aba, nLinhas, nColunas]);
  const cobertas = useMemo(() => {
    const ancoras = new Map<string, { colunas: number; linhas: number }>();
    const fora = new Set<string>();
    for (const m of aba.mesclagens) {
      if (m.l1 >= nLinhas || m.c1 >= nColunas) continue;
      ancoras.set(`${m.l1},${m.c1}`, { colunas: Math.min(m.c2, nColunas - 1) - m.c1 + 1, linhas: Math.min(m.l2, nLinhas - 1) - m.l1 + 1 });
      for (let l = m.l1; l <= Math.min(m.l2, nLinhas - 1); l++) for (let c = m.c1; c <= Math.min(m.c2, nColunas - 1); c++) if (l !== m.l1 || c !== m.c1) fora.add(`${l},${c}`);
    }
    return { ancoras, fora };
  }, [aba, nLinhas, nColunas]);
  const [arrasto, setArrasto] = useState<{ l: number; c: number } | null>(null);
  const [atual, setAtual] = useState<IntervaloXlsx | null>(null);
  const dentro = (i: IntervaloXlsx | null, l: number, c: number) => i !== null && l >= i.l1 && l <= i.l2 && c >= i.c1 && c <= i.c2;
  const sel = atual ?? p.selecao;

  const celulaDoEvento = (e: EventoPonteiro<HTMLTableElement>) => {
    const td = (e.target as HTMLElement).closest('td[data-l]');
    if (!td) return null;
    return { l: Number(td.getAttribute('data-l')), c: Number(td.getAttribute('data-c')) };
  };
  const intervaloEntre = (a: { l: number; c: number }, b: { l: number; c: number }): IntervaloXlsx => ({ l1: Math.min(a.l, b.l), c1: Math.min(a.c, b.c), l2: Math.max(a.l, b.l), c2: Math.max(a.c, b.c) });

  return (
    <div className="planilha-aba__rolagem" aria-label={`Células da aba ${aba.nome}`}>
      <table
        className="planilha-aba__grade"
        onPointerDown={(e) => {
          const x = celulaDoEvento(e);
          if (!x || e.button !== 0) return;
          e.preventDefault();
          setArrasto(x);
          setAtual(intervaloEntre(x, x));
        }}
        onPointerMove={(e) => {
          if (!arrasto) return;
          const x = celulaDoEvento(e);
          if (x) setAtual(intervaloEntre(arrasto, x));
        }}
        onPointerUp={() => {
          if (atual) p.aoSelecionar(atual);
          setArrasto(null);
          setAtual(null);
        }}
        onPointerLeave={() => {
          if (arrasto && atual) p.aoSelecionar(atual);
          setArrasto(null);
          setAtual(null);
        }}
      >
        <thead>
          <tr>
            <th aria-hidden="true" />
            {Array.from({ length: nColunas }, (_, c) => (
              <th key={c} scope="col">
                {letrasColuna(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: nLinhas }, (_, l) => (
            <tr key={l}>
              <th scope="row">{l + 1}</th>
              {Array.from({ length: nColunas }, (_, c) => {
                const k = `${l},${c}`;
                if (cobertas.fora.has(k)) return null;
                const a = cobertas.ancoras.get(k);
                const classes = ['planilha-aba__celula'];
                if (dentro(sel, l, c)) classes.push('planilha-aba__celula--selecionada');
                else if (p.marcados.some((m) => dentro(m, l, c))) classes.push('planilha-aba__celula--elemento');
                return (
                  <td key={c} data-l={l} data-c={c} className={classes.join(' ')} colSpan={a && a.colunas > 1 ? a.colunas : undefined} rowSpan={a && a.linhas > 1 ? a.linhas : undefined}>
                    <span className="planilha-aba__texto" title={textos.get(k) || undefined}>
                      {textos.get(k) ?? ''}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Um elemento: espécie, título, fonte, opções e prévia
// ---------------------------------------------------------------------------------------------------------

function CartaoElemento(p: { aba: AbaXlsx; e: Elemento; n: number; aoMudar: (e: Elemento) => void; aoRetirar: () => void }) {
  const base = useId();
  const { e } = p;
  const previa = useMemo(() => previaDe(p.aba, e), [p.aba, e]);
  const conv = previa?.conv ?? null;
  const mudarOpcoes = (o: Partial<OpcoesPlanilha>) => previa?.opcoes && p.aoMudar({ ...e, opcoes: { ...previa.opcoes, ...o } });
  const nome = e.especie === 'quadro' ? 'Quadro' : 'Tabela';
  return (
    <section className="planilha-elemento" aria-labelledby={`${base}-t`}>
      <div className="planilha-elemento__cabeca">
        <h4 id={`${base}-t`}>
          Elemento {p.n}: {e.aba} › {e.intervalo}
        </h4>
        <span className="dica">{e.rotulo}</span>
        <button type="button" className="btn-secundario" onClick={p.aoRetirar} aria-label={`Retirar o elemento ${p.n} (${e.intervalo})`}>
          Retirar
        </button>
      </div>
      <div className="planilha-elemento__campos">
        <fieldset className="planilha-elemento__especie">
          <legend>Espécie</legend>
          <label>
            <input type="radio" name={`${base}-esp`} checked={e.especie === 'tabela'} onChange={() => p.aoMudar({ ...e, especie: 'tabela' })} /> Tabela (dados numéricos)
          </label>
          <label>
            <input type="radio" name={`${base}-esp`} checked={e.especie === 'quadro'} onChange={() => p.aoMudar({ ...e, especie: 'quadro' })} /> Quadro (texto)
          </label>
        </fieldset>
        <div className="elemento__campo">
          <label htmlFor={`${base}-titulo`}>Título (sem o número)</label>
          <input id={`${base}-titulo`} className="campo" value={e.titulo} aria-invalid={e.titulo.trim() === '' ? 'true' : undefined} onChange={(ev) => p.aoMudar({ ...e, titulo: ev.target.value })} />
          <span className="dica">“{nome} n –” é posto sozinho, na ordem do texto.</span>
        </div>
        <div className="elemento__campo">
          <label htmlFor={`${base}-fonte`}>Fonte</label>
          <input id={`${base}-fonte`} className="campo" value={e.fonte} placeholder="Ex.: Elaborado pelo autor (2026)." onChange={(ev) => p.aoMudar({ ...e, fonte: ev.target.value })} />
        </div>
      </div>
      <div className="tabela-planilha__opcoes">
        <label className="planilha-elemento__marca">
          <input type="checkbox" checked={e.intervaloOpcoes.retirarColunasVazias} onChange={(ev) => p.aoMudar({ ...e, intervaloOpcoes: { ...e.intervaloOpcoes, retirarColunasVazias: ev.target.checked } })} /> Retirar colunas sem nenhum valor
        </label>
        <label className="planilha-elemento__marca">
          <input type="checkbox" checked={e.intervaloOpcoes.retirarLinhasVazias} onChange={(ev) => p.aoMudar({ ...e, intervaloOpcoes: { ...e.intervaloOpcoes, retirarLinhasVazias: ev.target.checked } })} /> Retirar linhas vazias
        </label>
        {previa?.opcoes && conv && (
          <>
            <div className="elemento__campo">
              <label htmlFor={`${base}-cab`}>Linhas de cabeçalho</label>
              <input id={`${base}-cab`} className="campo campo--curto" type="number" min={0} max={conv.grade.length} value={conv.linhasCabecalho} onChange={(ev) => mudarOpcoes({ linhasCabecalho: Math.max(0, Number(ev.target.value) || 0) })} />
            </div>
            <div className="elemento__campo">
              <label htmlFor={`${base}-vaz`}>Células vazias nas colunas de números</label>
              <select id={`${base}-vaz`} className="campo" value={previa.opcoes.vazios} onChange={(ev) => mudarOpcoes({ vazios: ev.target.value as SinalParaVazio })}>
                {VAZIOS.map((v) => (
                  <option key={v.rotulo} value={v.valor}>
                    {v.rotulo}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>
      {previa === null ? (
        <p className="aviso" role="status">
          <Icone nome="alerta" />
          <span className="aviso__texto">Intervalo inválido: use a forma A1:C10.</span>
        </p>
      ) : conv === null || conv.vazia ? (
        <p className="aviso" role="status">
          <Icone nome="alerta" />
          <span className="aviso__texto">O intervalo {e.intervalo} não tem nenhuma célula com valor.</span>
        </p>
      ) : (
        <>
          <p className="dica">
            Prévia: {conv.grade.length} {conv.grade.length === 1 ? 'linha' : 'linhas'} × {conv.alinhamentos.length} {conv.alinhamentos.length === 1 ? 'coluna' : 'colunas'}, no estilo acadêmico do{' '}
            {e.especie === 'quadro' ? 'quadro (fechado, com todas as linhas)' : 'IBGE (aberta nas laterais)'}.
          </p>
          <div className="tabela-edicao__rolagem">
            <table className={`bd-tabela__grade tabela-planilha__grade${e.especie === 'quadro' ? ' planilha-elemento__grade--quadro' : ''}`}>
              <tbody>
                {conv.grade.slice(0, LINHAS_NA_PREVIA).map((linha, l) => (
                  <tr key={l}>
                    {linha.map((x, c) => {
                      if (x === null) return null;
                      const Celula = l < conv.linhasCabecalho ? 'th' : 'td';
                      return (
                        <Celula
                          key={c}
                          className={`bd-tabela__celula--${conv.alinhamentos[c]}`}
                          colSpan={x.colunas > 1 ? x.colunas : undefined}
                          rowSpan={x.linhas > 1 ? Math.min(x.linhas, LINHAS_NA_PREVIA - l) : undefined}
                          {...(Celula === 'th' ? { scope: 'col' } : {})}
                        >
                          {x.campo.texto}
                        </Celula>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {conv.grade.length > LINHAS_NA_PREVIA && <p className="dica">E mais {conv.grade.length - LINHAS_NA_PREVIA} linhas.</p>}
          {conv.relatorio.length > 0 ? (
            <ul className="avisos" aria-label={`O que muda no elemento ${p.n}`}>
              {conv.relatorio.map((t) => (
                <li key={t} className="aviso">
                  <Icone nome="alerta" />
                  <span className="aviso__texto">{t}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dica">Nada a ajustar: os dados entram como estão na planilha.</p>
          )}
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------
// Janela
// ---------------------------------------------------------------------------------------------------------

export function DialogoImportarPlanilha(p: PropsDialogoImportarPlanilha) {
  const ref = useRef<HTMLDialogElement>(null);
  const refArquivo = useRef<HTMLInputElement>(null);
  const base = useId();
  const [arquivo, setArquivo] = useState<{ nome: string; pasta: PastaXlsx } | null>(null);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [elementos, setElementos] = useState<Elemento[]>([]);
  const [selecoes, setSelecoes] = useState<Record<string, string>>({});
  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [erros, setErros] = useState<string[]>([]);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>(`#${CSS.escape(`${base}-arquivo`)}`)?.focus();
    }
    return () => d?.close();
  }, [base]);

  const abas = arquivo?.pasta.abas ?? [];
  const abaDe = (nome: string) => abas.find((a) => a.nome === nome);

  const escolher = async (f: File | undefined) => {
    if (!f) return;
    setErros([]);
    if (f.size > LIMITE_BYTES_XLSX) return setAnuncio(`“${f.name}” é grande demais para importar (limite de ${LIMITE_BYTES_XLSX / 1024 / 1024} MB).`);
    const r = lerPastaXlsx(new Uint8Array(await f.arrayBuffer()));
    if (!r.ok) return setAnuncio(`“${f.name}”: ${r.mensagem}`);
    setArquivo({ nome: f.name, pasta: r.pasta });
    setMarcadas([]);
    setElementos([]);
    setSelecoes({});
    setAnuncio(`“${f.name}”: ${r.pasta.abas.length} ${r.pasta.abas.length === 1 ? 'aba' : 'abas'}. Marque as que vão para o trabalho.${r.pasta.avisos.length > 0 ? ` ${r.pasta.avisos.join(' ')}` : ''}`);
  };

  const alternarAba = (aba: AbaXlsx, marcar: boolean) => {
    setErros([]);
    if (marcar) {
      setMarcadas((m) => abas.filter((a) => a.nome === aba.nome || m.includes(a.nome)).map((a) => a.nome));
      setElementos((es) => [...es.filter((x) => x.aba !== aba.nome), ...elementosDaAba(aba)].sort((a, b) => abas.findIndex((x) => x.nome === a.aba) - abas.findIndex((x) => x.nome === b.aba)));
    } else {
      setMarcadas((m) => m.filter((x) => x !== aba.nome));
      setElementos((es) => es.filter((x) => x.aba !== aba.nome));
    }
  };

  const acrescentar = (aba: AbaXlsx) => {
    const texto = selecoes[aba.nome] ?? '';
    const i = lerIntervalo(texto);
    if (!i) return setAnuncio(`Intervalo “${texto}” inválido em “${aba.nome}”: arraste na grade ou digite na forma A1:C10.`);
    const novo: Elemento = { chave: proximaChave++, aba: aba.nome, intervalo: textoIntervalo(i), rotulo: 'Intervalo escolhido', especie: especieSugerida(aba, i), titulo: '', fonte: '', intervaloOpcoes: OPCOES_INTERVALO_PADRAO };
    setElementos((es) => {
      const ultimo = es.map((x) => x.aba).lastIndexOf(aba.nome);
      return ultimo < 0 ? [...es, novo] : [...es.slice(0, ultimo + 1), novo, ...es.slice(ultimo + 1)];
    });
    setAnuncio(`Elemento acrescentado: ${aba.nome} › ${textoIntervalo(i)}.`);
  };

  const mudar = (e: Elemento) => setElementos((es) => es.map((x) => (x.chave === e.chave ? e : x)));

  const semTitulo = elementos.flatMap((e, k) => (e.titulo.trim() === '' ? [String(k + 1)] : []));
  const pendencias =
    semTitulo.length === 0 ? [] : [semTitulo.length === 1 ? `Falta o título do elemento ${semTitulo[0]}.` : `Falta o título dos elementos ${semTitulo.slice(0, -1).join(', ')} e ${semTitulo.at(-1)}.`];

  const inserir = () => {
    const lista: DadosTabela[] = [];
    const problemas: string[] = [];
    elementos.forEach((e, k) => {
      const aba = abaDe(e.aba);
      const previa = aba ? previaDe(aba, e) : null;
      const onde = `Elemento ${k + 1} (${e.aba} › ${e.intervalo})`;
      if (!previa?.conv || previa.conv.vazia) {
        problemas.push(`${onde}: o intervalo não tem dados.`);
        return;
      }
      const r = {
        ...aplicarPlanilha(rascunhoNovo(e.especie), previa.conv),
        titulo: { texto: e.titulo },
        fonte: { texto: e.fonte },
        origem: { arquivo: arquivo!.nome.slice(0, 260), aba: e.aba.slice(0, 100), intervalo: e.intervalo },
      };
      const v = validarTabela(r);
      if (!v.ok) problemas.push(...v.erros.map((x) => `${onde}, ${x.campo}: ${x.mensagem}.`));
      else lista.push(v.dados);
    });
    if (problemas.length > 0 || lista.length === 0) {
      setErros(problemas.length > 0 ? problemas : ['Marque ao menos uma aba com dados.']);
      return;
    }
    p.aoInserir(lista);
  };

  return (
    <dialog
      ref={ref}
      className="dialogo dialogo--planilha"
      aria-labelledby={`${base}-titulo`}
      onCancel={(e) => {
        e.preventDefault();
        p.aoFechar();
      }}
      onClose={aoFecharDialogo(p.aoFechar)}
    >
      <form
        className="dialogo__corpo"
        aria-labelledby={`${base}-titulo`}
        onSubmit={(e) => {
          e.preventDefault();
          inserir();
        }}
      >
        <h2 id={`${base}-titulo`}>Importar planilha</h2>
        <div className="planilha__arquivo">
          <button id={`${base}-arquivo`} type="button" className="btn-secundario" onClick={() => refArquivo.current?.click()}>
            {arquivo ? 'Escolher outro arquivo…' : 'Escolher planilha (.xlsx)…'}
          </button>
          {arquivo && <span className="planilha__nome">{arquivo.nome}</span>}
          <input
            ref={refArquivo}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            aria-label="Planilha do Excel"
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              ev.target.value = '';
              void escolher(f);
            }}
          />
          <span className="dica">O arquivo só é lido: nada nele muda. Arquivo .xls ou .ods: salve como .xlsx no Excel ou no LibreOffice.</span>
        </div>
        {anuncio !== null && (
          <p className="dica" role="status">
            {anuncio}
          </p>
        )}

        {arquivo && (
          <div className="planilha__corpo">
            <fieldset className="planilha__abas">
              <legend>Abas</legend>
              {abas.map((a) => {
                const n = a.preenchida ? sugerirIntervalos(a).length : 0;
                return (
                  <label key={a.nome} className="planilha__aba">
                    <input type="checkbox" checked={marcadas.includes(a.nome)} disabled={!a.preenchida} onChange={(ev) => alternarAba(a, ev.target.checked)} />
                    <span>
                      <span className="planilha__aba-nome">{a.nome}</span>
                      <span className="dica">
                        {!a.preenchida ? ' vazia' : ` ${textoIntervalo(a.preenchida)}${n > 1 ? `, ${n} elementos` : ''}`}
                        {a.oculta ? ', oculta' : ''}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            <div className="planilha__detalhes">
              {marcadas.length === 0 && <p className="dica">Marque uma ou várias abas. Deixe de fora as auxiliares (siglas, referências, rascunhos).</p>}
              {marcadas.map((nome) => {
                const aba = abaDe(nome);
                if (!aba) return null;
                const seus = elementos.filter((x) => x.aba === nome);
                const marcadosNaGrade = seus.map((x) => lerIntervalo(x.intervalo)).filter((x): x is IntervaloXlsx => x !== null);
                const sel = lerIntervalo(selecoes[nome] ?? '');
                return (
                  <section key={nome} className="planilha__aba-detalhe" aria-labelledby={`${base}-aba-${abas.indexOf(aba)}`}>
                    <h3 id={`${base}-aba-${abas.indexOf(aba)}`}>Aba “{nome}”</h3>
                    <p className="dica">Arraste na grade para escolher outro intervalo. Em cor, os intervalos dos elementos desta aba.</p>
                    <GradeAba aba={aba} selecao={sel} marcados={marcadosNaGrade} aoSelecionar={(i) => setSelecoes((s) => ({ ...s, [nome]: textoIntervalo(i) }))} />
                    <div className="planilha__intervalo">
                      <label htmlFor={`${base}-int-${abas.indexOf(aba)}`}>Intervalo</label>
                      <input
                        id={`${base}-int-${abas.indexOf(aba)}`}
                        className="campo campo--curto"
                        value={selecoes[nome] ?? ''}
                        placeholder="A1:C10"
                        onChange={(ev) => setSelecoes((s) => ({ ...s, [nome]: ev.target.value.toUpperCase() }))}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter') {
                            ev.preventDefault();
                            acrescentar(aba);
                          }
                        }}
                      />
                      <button type="button" className="btn-secundario" onClick={() => acrescentar(aba)} disabled={!sel}>
                        Acrescentar como elemento
                      </button>
                      {aba.preenchida && (
                        <button type="button" className="btn-link" onClick={() => setSelecoes((s) => ({ ...s, [nome]: textoIntervalo(aba.preenchida!) }))}>
                          Área preenchida ({textoIntervalo(aba.preenchida)})
                        </button>
                      )}
                    </div>
                    {seus.length === 0 && <p className="dica">Nenhum elemento desta aba. Escolha um intervalo e acrescente.</p>}
                    {seus.map((e) => (
                      <CartaoElemento key={e.chave} aba={aba} e={e} n={elementos.indexOf(e) + 1} aoMudar={mudar} aoRetirar={() => setElementos((es) => es.filter((x) => x.chave !== e.chave))} />
                    ))}
                  </section>
                );
              })}
            </div>
          </div>
        )}

        {(erros.length > 0 || pendencias.length > 0) && (
          <ul className="avisos" aria-label="O que falta para inserir">
            {(erros.length > 0 ? erros : pendencias).map((t) => (
              <li key={t} className="aviso">
                <Icone nome="alerta" />
                <span className="aviso__texto">{t}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="dialogo__acoes">
          <span className="dica planilha__resumo">
            {elementos.length === 0 ? 'Nenhum elemento escolhido.' : `${elementos.length} ${elementos.length === 1 ? 'elemento entra' : 'elementos entram'} no cursor, na ordem acima. Ctrl+Z desfaz a importação.`}
          </span>
          <button type="submit" className="btn-principal" disabled={elementos.length === 0 || pendencias.length > 0}>
            {elementos.length > 1 ? `Inserir ${elementos.length} elementos` : 'Inserir'}
          </button>
          <button type="button" className="btn-secundario" onClick={p.aoFechar}>
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  );
}
