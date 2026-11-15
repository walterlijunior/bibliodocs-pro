/**
 * Dados de planilha na janela da tabela (M5-T05; RF-09; D-M5-01): colar as células copiadas no Excel ou no LibreOffice
 * (HTML ou texto com tabulações) ou importar um CSV. A prévia mostra a grade convertida e o relatório do que mudou ou
 * não converteu; só "Usar estes dados" troca a grade da janela. Título, fonte e notas ficam.
 */
import { useId, useMemo, useRef, useState, type ClipboardEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  converterPlanilha,
  detectarSeparador,
  estimarPedido,
  LIMITE_BASE64_IMAGEM_IA,
  LIMITE_TEXTO_TABELA_IA,
  lerTabelaSugerida,
  pedidoGerarTabela,
  PROVEDORES,
  TITULO_GERAR_TABELA,
  type ApiIa,
  type PedidoIA,
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
import { estilosDeClasse, planilhaDoHtml } from '../editor/planilha-colada';
import { Icone } from '../Icones';
import { consumo } from '../ia/consumo';
import { DialogoAutorizacao } from '../ia/PainelIA';

/** Linhas mostradas na prévia. */
const LINHAS_NA_PREVIA = 10;

export interface PropsPlanilhaTabela {
  especie: 'tabela' | 'quadro';
  /** `sugestao`: título e fonte lidos pela IA (só preenchem campos vazios). */
  aoUsar: (convertida: PlanilhaConvertida, sugestao?: { titulo?: string; fonte?: string }) => void;
  /** Serviço de IA (especificação revista, Etapa 9): "Gerar com IA…" a partir de imagem ou texto. */
  ia?: ApiIa | undefined;
}

const base64De = (bytes: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

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
    const lida = planilhaDoHtml(arvoreDoHtmlColado(html), estilosDeClasse(html));
    if (lida) return lida;
  }
  if (texto.trim() === '') return null;
  return lerTextoColado(texto, texto.includes('\t') ? '\t' : detectarSeparador(texto));
}

export function PlanilhaTabela(p: PropsPlanilhaTabela) {
  const base = useId();
  const [previa, setPrevia] = useState<{ lida: PlanilhaLida; opcoes: OpcoesPlanilha; origem: string; sugestao?: { titulo?: string; fonte?: string } } | null>(null);
  // Gerar com IA (especificação revista, Etapa 9).
  const refImagem = useRef<HTMLInputElement>(null);
  const [iaAberta, setIaAberta] = useState(false);
  const [iaTexto, setIaTexto] = useState('');
  const [iaImagem, setIaImagem] = useState<{ nome: string; tipo: 'image/png' | 'image/jpeg'; base64: string } | null>(null);
  const [iaPedido, setIaPedido] = useState<{ pedido: PedidoIA; provedor: string } | null>(null);
  const [iaEnviando, setIaEnviando] = useState(false);
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

  const escolherImagem = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    const tipo = arquivo.type === 'image/png' || arquivo.type === 'image/jpeg' ? arquivo.type : null;
    if (!tipo) return setAnuncio(`“${arquivo.name}”: use uma imagem PNG ou JPEG.`);
    const base64 = base64De(new Uint8Array(await arquivo.arrayBuffer()));
    if (base64.length > LIMITE_BASE64_IMAGEM_IA) return setAnuncio(`“${arquivo.name}” é grande demais para enviar (até cerca de 6 MB).`);
    setIaImagem({ nome: arquivo.name, tipo, base64 });
    setAnuncio(null);
  };

  const pedirAutorizacao = async () => {
    if (!p.ia) return;
    try {
      const cfg = await p.ia.lerConfig();
      const provedor = PROVEDORES.find((x) => x.id === cfg.provedor);
      if (!cfg.ativa) return setAnuncio('A IA está desativada. Ative-a em Trabalho › Assistente de IA… ou cole os dados da planilha.');
      if (provedor?.exigeChave && !cfg.temChave) return setAnuncio('Falta a chave de API do serviço de IA: informe-a em Trabalho › Assistente de IA….');
      setIaPedido({
        pedido: pedidoGerarTabela({ especie: p.especie, ...(iaTexto.trim() ? { texto: iaTexto } : {}), ...(iaImagem ? { imagem: { tipo: iaImagem.tipo, base64: iaImagem.base64 } } : {}) }),
        provedor: provedor?.nome ?? 'serviço de IA',
      });
    } catch {
      setAnuncio('Não foi possível ler a configuração da IA.');
    }
  };

  const enviarIa = async (pedido: PedidoIA) => {
    setIaPedido(null);
    if (!p.ia) return;
    setIaEnviando(true);
    setAnuncio('Enviando à IA…');
    try {
      const r = await p.ia.enviar(pedido);
      if (!r.ok) return setAnuncio(`${r.mensagem} A grade não mudou.`);
      consumo.registrar({ em: new Date().toISOString(), operacao: TITULO_GERAR_TABELA, etapa: iaImagem ? `imagem ${iaImagem.nome}` : 'texto', uso: r.uso, estimativa: estimarPedido(pedido) }, r.limites, r.usoMes);
      const s = lerTabelaSugerida(r.texto);
      if (!s) return setAnuncio('A resposta da IA não trouxe uma tabela no formato pedido. Tente de novo ou cole os dados.');
      setIaAberta(false);
      setAnuncio(null);
      setPrevia({ lida: s.lida, opcoes: opcoesSugeridas(s.lida), origem: 'Sugestão da IA', sugestao: { ...(s.titulo ? { titulo: s.titulo } : {}), ...(s.fonte ? { fonte: s.fonte } : {}) } });
    } catch {
      setAnuncio('Não foi possível falar com o serviço de IA. A grade não mudou.');
    } finally {
      setIaEnviando(false);
    }
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
        {p.ia && (
          <button type="button" className="btn-secundario" aria-expanded={iaAberta} onClick={() => setIaAberta((a) => !a)}>
            Gerar com IA…
          </button>
        )}
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
      {iaAberta && p.ia && (
        <section className="tabela-planilha__ia" aria-labelledby={`${base}-ia`}>
          <h3 id={`${base}-ia`} className="elementos__grupo">Gerar {p.especie === 'quadro' ? 'o quadro' : 'a tabela'} com IA</h3>
          <p className="dica">
            Envie uma imagem (foto ou captura da tabela) ou cole o texto. A IA transcreve sem calcular nem completar; o que ela não ler com segurança vem marcado com “[?]”
            para você conferir. Tudo passa pela prévia antes de entrar na grade.
          </p>
          <input
            ref={refImagem}
            type="file"
            accept="image/png,image/jpeg"
            hidden
            aria-label="Imagem da tabela"
            onChange={(ev) => {
              const arquivo = ev.target.files?.[0];
              ev.target.value = '';
              void escolherImagem(arquivo);
            }}
          />
          <div className="acoes">
            <button type="button" className="btn-secundario" onClick={() => refImagem.current?.click()}>
              Escolher imagem…
            </button>
            {iaImagem && (
              <span className="dica">
                {iaImagem.nome}{' '}
                <button type="button" className="btn-link" onClick={() => setIaImagem(null)}>
                  Retirar
                </button>
              </span>
            )}
          </div>
          <label htmlFor={`${base}-ia-texto`}>Texto da tabela (opcional com imagem)</label>
          <textarea id={`${base}-ia-texto`} className="campo" rows={4} maxLength={LIMITE_TEXTO_TABELA_IA} value={iaTexto} onChange={(e) => setIaTexto(e.target.value)} />
          <button type="button" className="btn-principal" disabled={iaEnviando || (iaTexto.trim() === '' && iaImagem === null)} onClick={() => void pedirAutorizacao()}>
            Enviar à IA…
          </button>
        </section>
      )}
      {iaPedido &&
        createPortal(
          <DialogoAutorizacao
            provedor={iaPedido.provedor}
            pedidos={[{ chave: 'tabela', rotulo: TITULO_GERAR_TABELA, pedido: iaPedido.pedido }]}
            rotuloConteudo="material enviado"
            aoEnviar={() => void enviarIa(iaPedido.pedido)}
            aoCancelar={() => {
              setIaPedido(null);
              setAnuncio('Envio cancelado. Nada saiu do computador.');
            }}
          />,
          document.body,
        )}
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
                p.aoUsar(convertida, previa.sugestao);
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
