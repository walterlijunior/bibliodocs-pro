/**
 * Referência pronta (Etapa 5 da especificação de atualização, D-E5-06): o autor cola o texto que o portal oferece
 * (SciELO, Google Acadêmico, periódico, repositório, anais). O texto fica guardado como veio; pode sair assim na lista
 * de referências ("Usar este texto") e pode ser convertido em campos, com prévia: o que foi lido, o que ficou incerto
 * e o que falta. A conversão só preenche campos vazios. Texto sempre como texto (nunca HTML).
 */
import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  aplicarReferenciaLida,
  estimarPedido,
  lerObraSugerida,
  lerReferenciaColada,
  pedidoSugerirObra,
  PROVEDORES,
  TITULO_SUGERIR_OBRA,
  type ApiIa,
  type PedidoIA,
  type ReferenciaLida,
} from '../../aplicacao';
import { consumo } from '../ia/consumo';
import { DialogoAutorizacao } from '../ia/PainelIA';
import type { Obra } from '../../dominio/modelo';
import { Icone } from '../Icones';

const NOMES: Record<string, string> = {
  autores: 'autoria',
  titulo: 'título',
  subtitulo: 'subtítulo',
  periodico: 'periódico',
  local: 'local',
  editora: 'editora',
  ano: 'ano',
  volume: 'volume',
  numero: 'número',
  paginas: 'páginas',
  edicao: 'edição',
  natureza: 'natureza',
  instituicao: 'instituição',
  noTodo: 'livro no todo',
  url: 'endereço eletrônico',
  acesso: 'data de acesso',
  doi: 'DOI',
  tipo: 'tipo de obra',
};

type Parte = { tipo: string; sobrenome?: string; prenomes?: string; nome?: string; texto?: string };

/** Valor lido, como texto: trechos juntos; autores separados por "; ". */
function valorLegivel(v: unknown): string {
  if (Array.isArray(v)) {
    const partes = v as Parte[];
    if (partes.every((x) => x.tipo === 'texto')) return partes.map((x) => x.texto ?? '').join('');
    return partes.map((x) => (x.tipo === 'pessoa' ? `${x.sobrenome ?? ''}, ${x.prenomes ?? ''}`.replace(/, $/, '') : (x.nome ?? ''))).join('; ');
  }
  if (typeof v === 'object' && v !== null && 'titulo' in v) return valorLegivel((v as { titulo: unknown }).titulo);
  return String(v);
}

export function ReferenciaColada(p: { obra: Obra; somenteLeitura: boolean; aoMudar: (obra: Obra) => void; rotuloTipo: (t: Obra['tipo']) => string; ia?: ApiIa | undefined }) {
  const base = useId();
  const [lida, setLida] = useState<(ReferenciaLida & { fontes?: Record<string, string> }) | null>(null);
  const [pedido, setPedido] = useState<{ pedido: PedidoIA; provedor: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const pedirIa = async () => {
    if (!p.ia) return;
    try {
      const cfg = await p.ia.lerConfig();
      const provedor = PROVEDORES.find((x) => x.id === cfg.provedor);
      if (!cfg.ativa) return setAnuncio('A IA está desativada. Ative-a em Trabalho › Assistente de IA… ou use “Converter em campos”.');
      if (provedor?.exigeChave && !cfg.temChave) return setAnuncio('Falta a chave de API do serviço de IA: informe-a em Trabalho › Assistente de IA….');
      setPedido({ pedido: pedidoSugerirObra(p.obra.referenciaLivre ?? ''), provedor: provedor?.nome ?? 'serviço de IA' });
    } catch {
      setAnuncio('Não foi possível ler a configuração da IA.');
    }
  };
  const enviar = async (x: PedidoIA) => {
    setPedido(null);
    if (!p.ia) return;
    setEnviando(true);
    setAnuncio('Enviando à IA…');
    try {
      const r = await p.ia.enviar(x);
      if (!r.ok) return setAnuncio(`${r.mensagem} A obra não mudou.`);
      consumo.registrar({ em: new Date().toISOString(), operacao: TITULO_SUGERIR_OBRA, etapa: 'obra', uso: r.uso, estimativa: estimarPedido(x) }, r.limites, r.usoMes);
      const s = lerObraSugerida(r.texto);
      if (!s) return setAnuncio('A resposta da IA não veio no formato pedido. Tente de novo ou use “Converter em campos”.');
      setAnuncio('Sugestão da IA abaixo: revise antes de preencher.');
      setLida(s);
    } catch {
      setAnuncio('Não foi possível falar com o serviço de IA. A obra não mudou.');
    } finally {
      setEnviando(false);
    }
  };
  const [anuncio, setAnuncio] = useState<string | null>(null);
  const texto = p.obra.referenciaLivre ?? '';
  return (
    <details className="elemento__grupo referencia-colada" open={texto !== '' || undefined}>
      <summary>Referência pronta (colada de um portal)</summary>
      <p className="dica">
        Cole a referência que o SciELO, o Google Acadêmico, o periódico ou o repositório oferecem. O texto fica guardado como veio. Você pode usá-lo na lista de referências ou
        convertê-lo em campos, que seguem o padrão do perfil.
      </p>
      <label htmlFor={`${base}-texto`}>Texto da referência</label>
      <textarea
        id={`${base}-texto`}
        className="campo"
        rows={3}
        value={texto}
        readOnly={p.somenteLeitura}
        onChange={(ev) => {
          const v = ev.target.value;
          const { referenciaLivre: _r, usarReferenciaLivre: _u, ...resto } = p.obra;
          p.aoMudar(v.trim() === '' ? resto : { ...resto, referenciaLivre: v, ...(p.obra.usarReferenciaLivre ? { usarReferenciaLivre: true } : {}) });
          setLida(null);
        }}
      />
      <label className="planilha-elemento__marca">
        <input
          type="checkbox"
          disabled={p.somenteLeitura || texto.trim() === ''}
          checked={p.obra.usarReferenciaLivre === true}
          onChange={(ev) => {
            const { usarReferenciaLivre: _u, ...resto } = p.obra;
            p.aoMudar(ev.target.checked ? { ...resto, usarReferenciaLivre: true } : resto);
          }}
        />
        Usar este texto na lista de referências, como foi colado
      </label>
      {!p.somenteLeitura && (
        <div className="acoes">
          <button type="button" className="btn-secundario" disabled={texto.trim() === ''} onClick={() => setLida(lerReferenciaColada(texto))}>
            Converter em campos…
          </button>
          {p.ia && (
            <button type="button" className="btn-secundario" disabled={texto.trim() === '' || enviando} onClick={() => void pedirIa()} title="A IA lê o texto acima (referência, trecho da página, texto do PDF ou o link) e sugere os campos; nada é gravado sem a sua revisão.">
              Sugerir com IA…
            </button>
          )}
        </div>
      )}
      {anuncio && (
        <p className="dica" role="status">
          {anuncio}
        </p>
      )}
      {lida && (
        <section className="referencia-colada__previa" aria-labelledby={`${base}-previa`}>
          <h3 id={`${base}-previa`} className="elementos__grupo">
            O que foi lido
          </h3>
          <dl className="formulario__dados">
            <dt>Tipo de obra</dt>
            <dd>{p.rotuloTipo(lida.tipo)} (confira)</dd>
            {Object.entries(lida.campos).map(([c, v]) => (
              <div key={c} className={lida.incertos.some((x) => x.campo === c) ? 'referencia-colada__incerto' : undefined}>
                <dt>
                  {NOMES[c] ?? c}
                  {lida.incertos.some((x) => x.campo === c) ? ' (confira)' : ''}
                </dt>
                <dd>
                  {valorLegivel(v)}
                  {lida.fontes?.[c] && <span className="dica"> Fonte: “{lida.fontes[c]}”</span>}
                </dd>
              </div>
            ))}
          </dl>
          {(lida.incertos.length > 0 || lida.faltando.length > 0) && (
            <ul className="avisos" aria-label="O que conferir">
              {lida.incertos.map((x) => (
                <li key={`${x.campo}-${x.motivo}`} className="aviso">
                  <Icone nome="alerta" />
                  <span className="aviso__texto">{x.motivo}</span>
                </li>
              ))}
              {lida.faltando.length > 0 && (
                <li className="aviso">
                  <Icone nome="alerta" />
                  <span className="aviso__texto">Não está no texto: {lida.faltando.join(', ')}.</span>
                </li>
              )}
            </ul>
          )}
          <div className="acoes">
            <button
              type="button"
              className="btn-principal"
              onClick={() => {
                const r = aplicarReferenciaLida(p.obra, lida, texto);
                p.aoMudar(r.obra);
                setLida(null);
                setAnuncio(
                  `${r.preenchidos.length === 0 ? 'Nenhum campo vazio a preencher.' : `Preenchidos: ${r.preenchidos.map((c) => NOMES[c] ?? c).join(', ')}.`}${
                    r.mantidos.length > 0 ? ` Mantidos como você escreveu: ${r.mantidos.map((c) => NOMES[c] ?? c).join(', ')}.` : ''
                  } Confira os campos marcados.`,
                );
              }}
            >
              Preencher os campos vazios
            </button>
            <button type="button" className="btn-secundario" onClick={() => setLida(null)}>
              Descartar
            </button>
          </div>
        </section>
      )}
      {pedido &&
        createPortal(
          <DialogoAutorizacao
            provedor={pedido.provedor}
            pedidos={[{ chave: 'obra', rotulo: TITULO_SUGERIR_OBRA, pedido: pedido.pedido }]}
            rotuloConteudo="material enviado"
            aoEnviar={() => void enviar(pedido.pedido)}
            aoCancelar={() => {
              setPedido(null);
              setAnuncio('Envio cancelado. Nada saiu do computador.');
            }}
          />,
          document.body,
        )}
    </details>
  );
}
