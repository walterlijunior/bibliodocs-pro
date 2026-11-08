/**
 * Janela do gráfico gerado de tabela (M5-T09; RF-10; D-M5-08): a tabela de onde vêm os dados, a forma (colunas, barras,
 * linhas, setores), as colunas que viram séries, título, largura, fonte e nota, com a prévia desenhada pelo mesmo código
 * da exportação. Os dados não são copiados: o gráfico continua ligado à tabela e muda com ela.
 *
 * - Só tabelas (espécie `tabela`) aparecem: quadro é textual (RN-061).
 * - Gráfico novo: a fonte começa com a da tabela (D-M5-51), que o autor pode trocar.
 * - Gravar exige título, tabela e algum valor numérico; o que falta aparece na lista, como na janela da figura.
 * - Título, fonte e nota em texto simples: sem mudança, as marcas do que já estava gravado ficam.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ElementoNaSessao } from '../../aplicacao';
import type { BlocoTabela, FormaGrafico, InlineDeTitulo } from '../../dominio/modelo';
import { dadosDoGrafico, lerNumero, tamanhoGraficoMm } from '../../aplicacao';
import { desenharEm } from '../editor/pintar-grafico';
import type { CamposGrafico } from '../editor/tabelas';
import { Icone } from '../Icones';

const FORMAS: readonly { forma: FormaGrafico; nome: string }[] = [
  { forma: 'colunas', nome: 'Colunas' },
  { forma: 'barras', nome: 'Barras' },
  { forma: 'linhas', nome: 'Linhas' },
  { forma: 'setores', nome: 'Setores' },
];

/** Cópia de `LIMITES_V1.larguraIlustracaoMm` (a interface só importa tipos do esquema; o teste da figura confere). */
const LARGURA = { minimo: 10, maximo: 500 };

const textoDe = (c: readonly InlineDeTitulo[] | undefined): string => (c ?? []).map((i) => i.texto).join('');
/** Mantém as marcas quando o texto não mudou; senão, texto simples. Vazio = ausente. */
const inlineDe = (texto: string, original: readonly InlineDeTitulo[] | undefined): InlineDeTitulo[] | undefined => {
  const t = texto.trim();
  if (t === '') return undefined;
  if (original && textoDe(original).trim() === t) return [...original];
  return [{ tipo: 'texto', texto: t }];
};

/** Texto da coluna no cabeçalho, para os rótulos das séries. */
function nomesDasColunas(t: BlocoTabela): string[] {
  const nomes = t.colunas.map((_c, i) => `Coluna ${i + 1}`);
  for (let r = 0; r < Math.min(t.linhasCabecalho, t.linhas.length); r++) {
    let c = 0;
    for (const cel of t.linhas[r]!) {
      const texto = textoDe(cel.conteudo).trim();
      if (texto !== '' && c < nomes.length) nomes[c] = texto;
      c += cel.colunas ?? 1;
    }
  }
  return nomes;
}

export interface PropsDialogoGrafico {
  elementos: readonly ElementoNaSessao[];
  /** Campos do gráfico a alterar; `null` = gráfico novo. */
  inicial: CamposGrafico | null;
  /** Largura da área útil do perfil, em mm. */
  areaUtilMm: number;
  aoConfirmar: (dados: CamposGrafico) => void;
  aoFechar: () => void;
}

export function DialogoGrafico(p: PropsDialogoGrafico) {
  const ref = useRef<HTMLDialogElement>(null);
  const refPrevia = useRef<HTMLCanvasElement>(null);
  const base = useId();
  const { inicial, elementos, areaUtilMm } = p;
  const nova = inicial === null;
  const tabelas = useMemo(() => elementos.filter((e): e is ElementoNaSessao & { tabela: BlocoTabela } => e.tabela !== undefined), [elementos]);
  const [tabelaId, setTabelaId] = useState<string>(inicial?.tabela ?? tabelas[0]?.id ?? '');
  const [forma, setForma] = useState<FormaGrafico>(inicial?.forma ?? 'colunas');
  const [series, setSeries] = useState<number[] | null>(inicial?.series ?? null);
  const [titulo, setTitulo] = useState(textoDe(inicial?.titulo));
  const [larguraTexto, setLarguraTexto] = useState(inicial?.larguraMm !== undefined ? String(inicial.larguraMm) : '');
  const tabela = tabelas.find((e) => e.id === tabelaId)?.tabela ?? null;
  const [fonte, setFonte] = useState(inicial ? textoDe(inicial.fonte) : textoDe(tabela?.fonte));
  const [nota, setNota] = useState(textoDe(inicial?.nota));

  const larguraMm = larguraTexto.trim() === '' ? undefined : Number(larguraTexto.trim().replace(',', '.'));
  const dados = useMemo(() => dadosDoGrafico({ forma, ...(series ? { series } : {}) }, tabela), [forma, series, tabela]);

  // Colunas que podem ser série (depois da indicadora) e as marcadas agora.
  const colunas = tabela ? nomesDasColunas(tabela).map((nome, c) => ({ nome, c })).slice(1) : [];
  const numericas = new Set(
    tabela
      ? colunas
          .filter(({ c }) => tabela.linhas.slice(tabela.linhasCabecalho).some((l) => {
            let k = 0;
            for (const cel of l) {
              if (k === c) return lerNumero(textoDe(cel.conteudo)) !== null;
              k += cel.colunas ?? 1;
            }
            return false;
          }))
          .map(({ c }) => c)
      : [],
  );
  const marcadas = new Set(series ?? [...numericas]);

  const faltas: string[] = [];
  if (tabelas.length === 0) faltas.push('Tabela: o trabalho ainda não tem tabela com números para gerar o gráfico.');
  else if (tabela === null) faltas.push('Tabela: escolha a tabela de onde vêm os dados.');
  else if (!dados.ok) faltas.push(`Dados: ${dados.mensagem}`);
  if (titulo.trim() === '') faltas.push('Título: o gráfico precisa de título.');
  if (larguraMm !== undefined && !(Number.isInteger(larguraMm) && larguraMm >= LARGURA.minimo && larguraMm <= LARGURA.maximo)) {
    faltas.push(`Largura: use um número inteiro de ${LARGURA.minimo} a ${LARGURA.maximo} mm, ou deixe em branco.`);
  }

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>('select, input')?.focus();
    }
    return () => d?.close();
  }, []);

  // Prévia com o mesmo desenho da exportação, na largura da janela.
  useEffect(() => {
    const c = refPrevia.current;
    if (!c) return;
    const { larguraMm: l, alturaMm: a } = tamanhoGraficoMm({ forma, ...(larguraMm !== undefined && Number.isFinite(larguraMm) ? { larguraMm } : {}) }, areaUtilMm);
    const escala = window.devicePixelRatio || 1;
    const pxPorMm = 3 * escala;
    c.width = Math.round(l * pxPorMm);
    c.height = Math.round(a * pxPorMm);
    const ctx = c.getContext('2d');
    if (!ctx) return;
    if (!desenharEm(ctx, { forma, ...(series ? { series } : {}) }, tabela, c.width, c.height, pxPorMm * 25.4, 'Times New Roman')) ctx.clearRect(0, 0, c.width, c.height);
  }, [forma, series, tabela, larguraMm, areaUtilMm]);

  const confirmar = () => {
    if (faltas.length > 0 || tabela === null) return;
    const t = inlineDe(titulo, inicial?.titulo)!;
    const f = inlineDe(fonte, inicial?.fonte);
    const n = inlineDe(nota, inicial?.nota);
    p.aoConfirmar({
      tipo: 'grafico',
      tabela: tabelaId,
      forma,
      titulo: t,
      ...(series ? { series } : {}),
      ...(larguraMm !== undefined ? { larguraMm } : {}),
      ...(f ? { fonte: f } : {}),
      ...(n ? { nota: n } : {}),
    });
  };

  const acao = nova ? 'Inserir gráfico' : 'Alterar gráfico';
  return (
    <dialog
      ref={ref}
      className="dialogo dialogo--tabela"
      aria-labelledby={`${base}-titulo`}
      onCancel={(e) => {
        e.preventDefault();
        p.aoFechar();
      }}
    >
      <form
        className="dialogo__corpo"
        aria-labelledby={`${base}-titulo`}
        onSubmit={(e) => {
          e.preventDefault();
          confirmar();
        }}
      >
        <h2 id={`${base}-titulo`}>{acao}</h2>

        <div className="elemento__campo">
          <label htmlFor={`${base}-tabela`}>Tabela de origem</label>
          <select
            id={`${base}-tabela`}
            className="campo"
            value={tabelaId}
            aria-describedby={`${base}-tabela-dica`}
            onChange={(ev) => {
              setTabelaId(ev.target.value);
              setSeries(null);
              if (nova) setFonte(textoDe(tabelas.find((x) => x.id === ev.target.value)?.tabela.fonte));
            }}
          >
            {tabelaId !== '' && tabela === null && <option value={tabelaId}>(tabela excluída)</option>}
            {tabelas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.descricao}
              </option>
            ))}
          </select>
          <span id={`${base}-tabela-dica`} className="dica">
            O gráfico continua ligado à tabela: mudar os números da tabela muda o gráfico. A 1.ª coluna dá os nomes das categorias.
          </span>
        </div>

        <fieldset className="elemento__grupo">
          <legend>Forma</legend>
          <div className="grafico-edicao__formas">
            {FORMAS.map((f) => (
              <label key={f.forma} className="tipos-trabalho__opcao">
                <input type="radio" name={`${base}-forma`} value={f.forma} checked={forma === f.forma} onChange={() => setForma(f.forma)} />
                <span>{f.nome}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {colunas.length > 0 && (
          <fieldset className="elemento__grupo">
            <legend>Séries (colunas da tabela)</legend>
            <div className="grafico-edicao__formas">
              {colunas.map(({ nome, c }) => (
                <label key={c} className="tipos-trabalho__opcao">
                  <input
                    type="checkbox"
                    checked={marcadas.has(c)}
                    disabled={!numericas.has(c)}
                    onChange={(ev) => {
                      const novas = new Set(marcadas);
                      if (ev.target.checked) novas.add(c);
                      else novas.delete(c);
                      const lista = [...novas].sort((a, b) => a - b);
                      const auto = [...numericas].sort((a, b) => a - b);
                      setSeries(lista.length === auto.length && lista.every((x, i) => x === auto[i]) ? null : lista.length > 0 ? lista : []);
                    }}
                  />
                  <span>{nome}</span>
                </label>
              ))}
            </div>
            {forma === 'setores' && <p className="dica">Setores usa só a primeira série marcada.</p>}
          </fieldset>
        )}

        <div className="figura-edicao__previa">
          <canvas ref={refPrevia} className="grafico-edicao__previa" role="img" aria-label={dados.ok ? `Prévia do gráfico de ${FORMAS.find((x) => x.forma === forma)!.nome.toLowerCase()}` : 'Sem prévia: faltam dados'} />
        </div>
        {dados.ok &&
          dados.avisos.map((a) => (
            <p key={a} className="aviso">
              <Icone nome="alerta" />
              <span className="aviso__texto">Atenção: {a}</span>
            </p>
          ))}

        <div className="elemento__campo">
          <label htmlFor={`${base}-titulo-campo`}>Título</label>
          <input id={`${base}-titulo-campo`} className="campo" value={titulo} aria-describedby={`${base}-titulo-dica`} onChange={(ev) => setTitulo(ev.target.value)} />
          <span id={`${base}-titulo-dica`} className="dica">
            Sem o número: “Gráfico 1 –” é posto sozinho, na ordem do texto.
          </span>
        </div>

        <div className="elemento__campo">
          <label htmlFor={`${base}-largura`}>Largura (mm)</label>
          <input
            id={`${base}-largura`}
            className="campo campo--curto"
            inputMode="numeric"
            value={larguraTexto}
            aria-describedby={`${base}-largura-dica`}
            onChange={(ev) => setLarguraTexto(ev.target.value)}
          />
          <span id={`${base}-largura-dica`} className="dica">
            Em branco: 150 mm, até a largura do texto ({areaUtilMm.toFixed(0)} mm).
          </span>
        </div>

        <div className="elemento__campo">
          <label htmlFor={`${base}-fonte`}>Fonte</label>
          <input id={`${base}-fonte`} className="campo" value={fonte} aria-describedby={`${base}-fonte-dica`} onChange={(ev) => setFonte(ev.target.value)} />
          <span id={`${base}-fonte-dica`} className="dica">
            Depois de “Fonte:”. Obrigatória; começa com a fonte da tabela.
          </span>
        </div>

        <div className="elemento__campo">
          <label htmlFor={`${base}-nota`}>Nota</label>
          <textarea id={`${base}-nota`} className="campo" rows={2} value={nota} onChange={(ev) => setNota(ev.target.value)} />
        </div>

        {faltas.length > 0 && (
          <ul className="avisos" aria-label="O que impede gravar o gráfico">
            {faltas.map((f) => (
              <li key={f} className="aviso aviso--erro">
                <Icone nome="erro" />
                <span className="aviso__texto">{f}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="dialogo__acoes">
          <button type="submit" className="btn-principal" disabled={faltas.length > 0}>
            {acao}
          </button>
          <button type="button" className="btn-secundario" onClick={p.aoFechar}>
            Cancelar
          </button>
        </div>
      </form>
    </dialog>
  );
}
