/**
 * Dados de planilha na janela da tabela (M5-T05; RF-09; D-M5-01): colar as células copiadas no Excel ou no LibreOffice
 * (HTML ou texto com tabulações) ou importar um CSV. A prévia mostra a grade convertida e o relatório do que mudou ou
 * não converteu; só "Usar estes dados" troca a grade da janela. Título, fonte e notas ficam.
 */
import { useId, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import {
  converterPlanilha,
  detectarSeparador,
  LIMITE_BYTES_CSV,
  lerCsv,
  lerTextoColado,
  opcoesSugeridas,
  type OpcoesPlanilha,
  type PlanilhaConvertida,
  type PlanilhaLida,
  type SinalParaVazio,
} from '../../aplicacao';
import { arvoreDoHtmlColado } from '../editor/colagem';
import { planilhaDoHtml } from '../editor/planilha-colada';
import { Icone } from '../Icones';

/** Linhas mostradas na prévia. */
const LINHAS_NA_PREVIA = 10;

export interface PropsPlanilhaTabela {
  especie: 'tabela' | 'quadro';
  aoUsar: (convertida: PlanilhaConvertida) => void;
}

const VAZIOS: readonly { valor: SinalParaVazio; rotulo: string }[] = [
  { valor: '', rotulo: 'Deixar vazias' },
  { valor: '...', rotulo: '... (dado não disponível)' },
  { valor: '–', rotulo: '– (dado igual a zero)' },
  { valor: '..', rotulo: '.. (não se aplica)' },
  { valor: 'X', rotulo: 'X (dado omitido)' },
];

/** O que foi colado: a tabela do HTML, ou o texto com tabulações (ou o separador do CSV, sem tabulação). */
function lerColagem(html: string, texto: string): PlanilhaLida | null {
  if (html) {
    const lida = planilhaDoHtml(arvoreDoHtmlColado(html));
    if (lida) return lida;
  }
  if (texto.trim() === '') return null;
  return lerTextoColado(texto, texto.includes('\t') ? '\t' : detectarSeparador(texto));
}

export function PlanilhaTabela(p: PropsPlanilhaTabela) {
  const base = useId();
  const [previa, setPrevia] = useState<{ lida: PlanilhaLida; opcoes: OpcoesPlanilha; origem: string } | null>(null);
  const [anuncio, setAnuncio] = useState<string | null>(null);
  const refArquivo = useRef<HTMLInputElement>(null);

  const convertida = useMemo(() => (previa ? converterPlanilha(previa.lida, p.especie, previa.opcoes) : null), [previa, p.especie]);

  const mostrar = (lida: PlanilhaLida | null, origem: string) => {
    if (lida === null || lida.linhas.length === 0) {
      setPrevia(null);
      setAnuncio('Nada para ler: copie as células na planilha e cole de novo.');
      return;
    }
    setAnuncio(null);
    setPrevia({ lida, opcoes: opcoesSugeridas(lida), origem });
  };

  const aoColar = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    mostrar(lerColagem(e.clipboardData.getData('text/html'), e.clipboardData.getData('text/plain')), 'Células coladas');
  };

  const aoEscolherArquivo = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    if (arquivo.size > LIMITE_BYTES_CSV) {
      setPrevia(null);
      setAnuncio(`“${arquivo.name}” é grande demais para importar (limite de ${LIMITE_BYTES_CSV / 1024 / 1024} MB).`);
      return;
    }
    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    let texto: string;
    const avisos: string[] = [];
    try {
      texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      texto = new TextDecoder('windows-1252').decode(bytes);
      avisos.push('O arquivo não está em UTF-8: foi lido como Windows-1252. Confira os acentos.');
    }
    mostrar(lerCsv(texto, avisos), `Arquivo “${arquivo.name}”`);
  };

  const mudar = (o: Partial<OpcoesPlanilha>) => previa && setPrevia({ ...previa, opcoes: { ...previa.opcoes, ...o } });

  return (
    <div className="tabela-planilha">
      <div className="tabela-planilha__entrada">
        <textarea
          className="campo tabela-planilha__colar"
          rows={2}
          value=""
          onChange={() => {}}
          aria-label="Colar da planilha"
          aria-describedby={`${base}-colar-dica`}
          placeholder="Copie as células no Excel ou no LibreOffice e cole aqui (Ctrl+V)"
          onPaste={aoColar}
        />
        <button type="button" className="btn-secundario" onClick={() => refArquivo.current?.click()}>
          Importar CSV…
        </button>
        <input
          ref={refArquivo}
          type="file"
          accept=".csv,text/csv"
          hidden
          aria-label="Arquivo CSV"
          onChange={(ev) => {
            const arquivo = ev.target.files?.[0];
            ev.target.value = '';
            void aoEscolherArquivo(arquivo);
          }}
        />
      </div>
      <span id={`${base}-colar-dica`} className="dica">
        Os dados substituem a grade abaixo depois da prévia. XLSX: salve como CSV no Excel ou no LibreOffice.
      </span>
      {anuncio !== null && (
        <p className="aviso" role="status">
          <Icone nome="alerta" />
          <span className="aviso__texto">{anuncio}</span>
        </p>
      )}

      {previa !== null && convertida !== null && (
        <section className="elemento__grupo tabela-planilha__previa" aria-labelledby={`${base}-previa`}>
          <h3 id={`${base}-previa`}>Prévia dos dados da planilha</h3>
          <p className="dica">
            {previa.origem}: {convertida.grade.length} {convertida.grade.length === 1 ? 'linha' : 'linhas'} × {convertida.alinhamentos.length}{' '}
            {convertida.alinhamentos.length === 1 ? 'coluna' : 'colunas'}.
          </p>
          <div className="tabela-planilha__opcoes">
            <div className="elemento__campo">
              <label htmlFor={`${base}-decimal`}>Separador decimal na planilha</label>
              <select id={`${base}-decimal`} className="campo" value={previa.opcoes.decimal} onChange={(ev) => mudar({ decimal: ev.target.value as OpcoesPlanilha['decimal'] })}>
                <option value="virgula">Vírgula: 1.234,5 (fica como está)</option>
                <option value="ponto">Ponto: 1,234.5 (convertido para 1.234,5)</option>
              </select>
            </div>
            <div className="elemento__campo">
              <label htmlFor={`${base}-vazios`}>Células vazias nas colunas de números</label>
              <select id={`${base}-vazios`} className="campo" value={previa.opcoes.vazios} onChange={(ev) => mudar({ vazios: ev.target.value as SinalParaVazio })}>
                {VAZIOS.map((v) => (
                  <option key={v.rotulo} value={v.valor}>
                    {v.rotulo}
                  </option>
                ))}
              </select>
            </div>
            <div className="elemento__campo">
              <label htmlFor={`${base}-cabecalho`}>Linhas de cabeçalho</label>
              <input
                id={`${base}-cabecalho`}
                className="campo campo--curto"
                type="number"
                min={0}
                max={convertida.grade.length}
                value={convertida.linhasCabecalho}
                onChange={(ev) => mudar({ linhasCabecalho: Math.max(0, Number(ev.target.value) || 0) })}
              />
            </div>
          </div>

          <div className="tabela-edicao__rolagem">
            <table className="bd-tabela__grade tabela-planilha__grade">
              <tbody>
                {convertida.grade.slice(0, LINHAS_NA_PREVIA).map((linha, l) => (
                  <tr key={l}>
                    {linha.map((x, c) => {
                      if (x === null) return null;
                      const Celula = l < convertida.linhasCabecalho ? 'th' : 'td';
                      return (
                        <Celula
                          key={c}
                          className={`bd-tabela__celula--${convertida.alinhamentos[c]}`}
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
          {convertida.grade.length > LINHAS_NA_PREVIA && <p className="dica">E mais {convertida.grade.length - LINHAS_NA_PREVIA} linhas.</p>}

          {convertida.relatorio.length > 0 ? (
            <ul className="avisos" aria-label="Relatório da conversão">
              {convertida.relatorio.map((t) => (
                <li key={t} className="aviso">
                  <Icone nome="alerta" />
                  <span className="aviso__texto">{t}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="dica">Nada a ajustar: os dados entram como vieram.</p>
          )}

          <div className="dialogo__acoes">
            <button
              type="button"
              className="btn-principal"
              disabled={convertida.vazia}
              onClick={() => {
                p.aoUsar(convertida);
                setPrevia(null);
                setAnuncio(`Dados da planilha na grade: ${convertida.grade.length} × ${convertida.alinhamentos.length}.`);
              }}
            >
              Usar estes dados
            </button>
            <button type="button" className="btn-secundario" onClick={() => setPrevia(null)}>
              Descartar
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
