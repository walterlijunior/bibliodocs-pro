/**
 * Assistente de IA (Etapa 8 da especificação de atualização), na aba Elementos, no lugar do editor.
 *
 * - Configuração: serviço (qualquer um compatível com a API de chat da OpenAI), endereço, modelo, chave de API (vai
 *   cifrada para o processo principal e não volta), limite mensal para acompanhar. Desativada, nada sai do computador.
 * - Consumo: o que o provedor informou (tokens por envio e na sessão, limites por minuto) separado do que o aplicativo
 *   estima; a cota restante da conta aparece como indisponível quando o serviço não a informa.
 * - Tarefas: antes de enviar, a janela mostra o conteúdo exato e pede autorização. Depois de cada etapa, um ponto de
 *   retomada é gravado; perto do limite, a tarefa pausa com o ponto gravado. Retomar envia só o que falta.
 * - Sugestões: aplicadas uma vez, com escolha do que entra; as células das tabelas nunca mudam.
 *
 * Texto sempre como texto (nunca HTML).
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  atualizarEtapa,
  dadosComSugestao,
  estimarPedido,
  etapasPendentes,
  lerSugestaoModelo,
  lerSugestaoTabela,
  limiteProximo,
  novoPonto,
  pedidoInterpretarModelo,
  pedidoRevisarTabela,
  PROVEDORES,
  somarUso,
  tarefaTerminada,
  type ApiIa,
  type ConfigIA,
  type DadosTabela,
  type EstadoConfigIA,
  type IdProvedor,
  type OperacaoIA,
  type PedidoIA,
  type PontoRetomada,
  type ResultadoObra,
  type UsoInformado,
} from '../../aplicacao';
import type { BlocoTabela, ModeloEvento, RegrasModelo } from '../../dominio/modelo';
import { aoFecharDialogo } from '../casca/dialogo';
import { consumo, useConsumo } from './consumo';

export interface TabelaParaIa {
  id: string;
  rotulo: string;
  descricao: string;
  bloco: BlocoTabela;
}

export interface PropsPainelIA {
  api: ApiIa;
  trabalho: { id: string; nome: string };
  tabelas: readonly TabelaParaIa[];
  modelo: ModeloEvento | undefined;
  somenteLeitura: boolean;
  /** Aplica a sugestão no editor (leva à aba Escrever, com Ctrl+Z). */
  aoAplicarTabela: (id: string, dados: DadosTabela) => void;
  aoAplicarModelo: (regras: Partial<RegrasModelo>) => ResultadoObra;
  /** O ponto de retomada mudou (o aviso da tela principal confere de novo). */
  aoMudarRetomada?: () => void;
}

interface Autorizacao {
  ponto: PontoRetomada;
  pedidos: { chave: string; rotulo: string; pedido: PedidoIA }[];
}

const numero = (n: number) => n.toLocaleString('pt-BR');
const textoUso = (u: UsoInformado | null | undefined) =>
  !u || u.total === undefined && u.entrada === undefined ? 'não informado pelo provedor' : `${numero(u.total ?? (u.entrada ?? 0) + (u.saida ?? 0))} tokens${u.entrada !== undefined && u.saida !== undefined ? ` (${numero(u.entrada)} de entrada, ${numero(u.saida)} de saída)` : ''}`;

export function PainelIA(p: PropsPainelIA) {
  const base = useId();
  const so = p.somenteLeitura;
  const { api, trabalho } = p;
  const [config, setConfig] = useState<EstadoConfigIA | null>(null);
  const [rascunho, setRascunho] = useState<ConfigIA | null>(null);
  const [chave, setChave] = useState('');
  const [limiteTexto, setLimiteTexto] = useState('');
  const [ponto, setPonto] = useState<PontoRetomada | null>(null);
  const [autorizacao, setAutorizacao] = useState<Autorizacao | null>(null);
  const [executando, setExecutando] = useState<string | null>(null);
  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [camposEscolhidos, setCamposEscolhidos] = useState<Record<string, ('titulo' | 'fonte' | 'nota')[]>>({});
  const parar = useRef(false);
  const c = useConsumo();

  const recarregar = useCallback(async () => {
    const [cfg, pt] = await Promise.all([api.lerConfig(), api.lerRetomada(trabalho.id)]);
    setConfig(cfg);
    setRascunho({ ativa: cfg.ativa, provedor: cfg.provedor, url: cfg.url, modelo: cfg.modelo, ...(cfg.limiteTokensMes ? { limiteTokensMes: cfg.limiteTokensMes } : {}) });
    setLimiteTexto(cfg.limiteTokensMes ? String(cfg.limiteTokensMes) : '');
    consumo.definirUsoMes(cfg.usoMes);
    setPonto(pt);
  }, [api, trabalho.id]);
  useEffect(() => {
    void recarregar();
  }, [recarregar]);
  useEffect(() => () => void (parar.current = true), []);

  const gravarPonto = async (novo: PontoRetomada | null) => {
    setPonto(novo);
    if (novo === null) await api.descartarRetomada(trabalho.id);
    else {
      const r = await api.gravarRetomada(novo);
      if (!r.ok) setAnuncio(r.mensagem);
    }
    p.aoMudarRetomada?.();
  };

  const salvarConfig = async (ativa?: boolean) => {
    if (!rascunho) return;
    const limite = limiteTexto.trim() === '' ? undefined : Number(limiteTexto.replace(/\D/g, ''));
    const { limiteTokensMes: _l, ...resto } = rascunho;
    const nova: ConfigIA = { ...resto, ativa: ativa ?? rascunho.ativa, ...(limite && limite > 0 ? { limiteTokensMes: limite } : {}) };
    const r = await api.gravarConfig(nova, chave.trim() === '' ? undefined : chave.trim());
    setChave('');
    setAnuncio(r.ok ? (nova.ativa ? 'Configuração da IA guardada.' : 'IA desativada: nada é enviado e os recursos manuais continuam.') : r.mensagem);
    await recarregar();
  };

  // ---------- montar e executar tarefas ----------

  const pedidoDaEtapa = (op: OperacaoIA, chaveEtapa: string): PedidoIA | null => {
    if (op === 'interpretarModelo') return p.modelo ? pedidoInterpretarModelo(p.modelo) : null;
    const t = p.tabelas.find((x) => x.id === chaveEtapa);
    return t ? pedidoRevisarTabela(t.bloco, t.rotulo) : null;
  };

  const pedirAutorizacao = async (pt: PontoRetomada) => {
    let atual = pt;
    const pedidos: Autorizacao['pedidos'] = [];
    for (const e of etapasPendentes(pt)) {
      const pedido = pedidoDaEtapa(pt.operacao, e.chave);
      // O elemento saiu do trabalho desde a interrupção: a etapa não é mais enviada.
      if (pedido === null) atual = atualizarEtapa(atual, e.chave, { estado: 'descartada' }, 'decisao', new Date());
      else pedidos.push({ chave: e.chave, rotulo: e.rotulo, pedido });
    }
    if (atual !== pt) await gravarPonto(atual);
    if (pedidos.length === 0) return setAnuncio('Não há etapas pendentes para enviar.');
    setAutorizacao({ ponto: atual, pedidos });
  };

  const iniciar = async (op: OperacaoIA) => {
    const etapas = op === 'revisarTabelas' ? p.tabelas.map((t) => ({ chave: t.id, rotulo: t.descricao })) : [{ chave: 'modelo', rotulo: `Modelo “${p.modelo?.nome ?? ''}”` }];
    if (etapas.length === 0) return setAnuncio('O trabalho não tem tabelas nem quadros.');
    const pt = novoPonto(trabalho, op, etapas, new Date());
    await gravarPonto(pt);
    await pedirAutorizacao(pt);
  };

  const executar = async (a: Autorizacao) => {
    setAutorizacao(null);
    parar.current = false;
    let pt = a.ponto;
    for (let i = 0; i < a.pedidos.length; i++) {
      if (parar.current) break;
      const { chave: k, rotulo, pedido } = a.pedidos[i]!;
      setExecutando(`Enviando ${i + 1} de ${a.pedidos.length}: ${rotulo}`);
      const r = await api.enviar(pedido);
      if (!r.ok) {
        pt = { ...pt, motivo: 'falha', atualizadoEm: new Date().toISOString() };
        await gravarPonto(pt);
        setAnuncio(`${r.mensagem} O que já foi feito está guardado: use “Retomar” depois.`);
        break;
      }
      consumo.registrar({ em: new Date().toISOString(), operacao: pt.titulo, etapa: rotulo, uso: r.uso, estimativa: estimarPedido(pedido) }, r.limites, r.usoMes);
      pt = atualizarEtapa(pt, k, { estado: 'concluida', resposta: r.texto, ...(r.uso ? { uso: r.uso } : {}) }, 'etapa', new Date());
      await gravarPonto(pt);
      const proximo = a.pedidos[i + 1];
      const aviso = proximo ? limiteProximo(r.limites, estimarPedido(proximo.pedido), r.usoMes.tokens, config?.limiteTokensMes) : null;
      if (aviso) {
        pt = { ...pt, motivo: 'limite' };
        await gravarPonto(pt);
        setAnuncio(`Tarefa pausada: ${aviso} O ponto de retomada foi gravado; use “Retomar” quando quiser continuar.`);
        break;
      }
    }
    setExecutando(null);
    if (etapasPendentes(pt).length === 0) setAnuncio('Tarefa concluída. Confira as sugestões abaixo.');
  };

  const decidir = async (k: string, estado: 'aplicada' | 'descartada') => {
    if (!ponto) return;
    const novo = atualizarEtapa(ponto, k, { estado }, 'decisao', new Date());
    if (tarefaTerminada(novo)) {
      await gravarPonto(null);
      setAnuncio('Todas as sugestões foram decididas: a tarefa foi encerrada.');
    } else await gravarPonto(novo);
  };

  // ---------- tela ----------

  if (!config || !rascunho) return <p className="dica">Carregando a configuração da IA…</p>;
  const provedor = PROVEDORES.find((x) => x.id === rascunho.provedor)!;
  const totalSessao = c.envios.reduce<UsoInformado>((u, e) => somarUso(u, e.uso), {});
  const estimadoSessao = c.envios.reduce((n, e) => n + e.estimativa, 0);
  const usoMes = c.usoMes ?? config.usoMes;
  const limite = config.limiteTokensMes;
  const concluidas = ponto?.etapas.filter((e) => e.estado !== 'pendente').length ?? 0;

  return (
    <div className="gerenciador assistente-ia" aria-labelledby={`${base}-titulo`}>
      <h2 id={`${base}-titulo`}>Assistente de IA</h2>
      <p className="dica">
        {config.ativa
          ? `Ativo com ${PROVEDORES.find((x) => x.id === config.provedor)?.nome ?? 'serviço'} (${config.modelo}). Nada é enviado sem a sua autorização.`
          : 'Desativado: nada sai do computador. Os recursos manuais continuam (conferência, verificador, edição de tabelas e do modelo).'}
      </p>

      <details className="registro__colunas" open={!config.ativa}>
        <summary>Configurar o serviço de IA</summary>
        <div className="registro__campos">
          <label htmlFor={`${base}-prov`}>Serviço</label>
          <select
            id={`${base}-prov`}
            className="campo"
            value={rascunho.provedor}
            disabled={so}
            onChange={(e) => {
              const novo = PROVEDORES.find((x) => x.id === (e.target.value as IdProvedor))!;
              setRascunho({ ...rascunho, provedor: novo.id, url: novo.url || rascunho.url, modelo: novo.modelo || rascunho.modelo });
            }}
          >
            {PROVEDORES.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
          <label htmlFor={`${base}-url`}>Endereço da API</label>
          <input id={`${base}-url`} className="campo" value={rascunho.url} readOnly={so} placeholder="https://…/v1" onChange={(e) => setRascunho({ ...rascunho, url: e.target.value })} />
          <label htmlFor={`${base}-modelo`}>Modelo</label>
          <input id={`${base}-modelo`} className="campo" value={rascunho.modelo} readOnly={so} onChange={(e) => setRascunho({ ...rascunho, modelo: e.target.value })} />
          <label htmlFor={`${base}-chave`}>Chave de API{provedor.exigeChave ? '' : ' (se o serviço pedir)'}</label>
          <input
            id={`${base}-chave`}
            className="campo"
            type="password"
            autoComplete="off"
            value={chave}
            readOnly={so}
            placeholder={config.temChave ? 'Guardada (cifrada). Digite outra para trocar.' : 'Cole a chave criada no site do serviço'}
            onChange={(e) => setChave(e.target.value)}
          />
          {!config.cifraDisponivel && <p className="dica">Este computador não oferece cifra para a chave: ela não pode ser guardada.</p>}
          <label htmlFor={`${base}-limite`}>Limite de tokens por mês para acompanhar (opcional)</label>
          <input id={`${base}-limite`} className="campo" inputMode="numeric" value={limiteTexto} readOnly={so} onChange={(e) => setLimiteTexto(e.target.value)} />
        </div>
        {!so && (
          <div className="acoes">
            <button type="button" className="btn-principal" onClick={() => void salvarConfig(true)}>
              Salvar e ativar
            </button>
            {config.ativa && (
              <button type="button" className="btn-secundario" onClick={() => void salvarConfig(false)}>
                Desativar a IA
              </button>
            )}
            {config.temChave && (
              <button
                type="button"
                className="btn-secundario"
                onClick={() =>
                  void api.apagarChave().then(async () => {
                    setAnuncio('Chave apagada deste computador.');
                    await recarregar();
                  })
                }
              >
                Apagar a chave
              </button>
            )}
          </div>
        )}
      </details>

      <section aria-labelledby={`${base}-consumo`} className="assistente-ia__consumo">
        <h3 id={`${base}-consumo`} className="elementos__grupo">Consumo</h3>
        <dl className="formulario__dados">
          <dt>Nesta sessão (informado pelo provedor)</dt>
          <dd>{c.envios.length === 0 ? 'nenhum envio' : `${textoUso(totalSessao)} em ${c.envios.length} ${c.envios.length === 1 ? 'envio' : 'envios'}`}</dd>
          <dt>Nesta sessão (estimativa do aplicativo)</dt>
          <dd>{c.envios.length === 0 ? '—' : `cerca de ${numero(estimadoSessao)} tokens`}</dd>
          <dt>Neste mês ({usoMes.mes}, informado pelo provedor)</dt>
          <dd>{numero(usoMes.tokens)} tokens</dd>
          <dt>Cota restante da conta</dt>
          <dd>Indisponível: o serviço não informa a cota restante pela API. Confira no site do serviço.</dd>
          {c.limites?.tokensRestantes !== undefined && (
            <>
              <dt>Limite por minuto (informado pelo provedor)</dt>
              <dd>
                {numero(c.limites.tokensRestantes)} tokens restantes{c.limites.tokensLimite ? ` de ${numero(c.limites.tokensLimite)}` : ''}
              </dd>
            </>
          )}
        </dl>
        {limite !== undefined && (
          <div>
            <label htmlFor={`${base}-barra`}>Uso do mês sobre o limite que você definiu (soma do uso informado pelo provedor)</label>
            <progress id={`${base}-barra`} max={limite} value={Math.min(usoMes.tokens, limite)}>
              {Math.round((usoMes.tokens / limite) * 100)}%
            </progress>{' '}
            {Math.round((usoMes.tokens / limite) * 100)}% de {numero(limite)} tokens
          </div>
        )}
        {c.envios.length > 0 && (
          <details>
            <summary>Envios desta sessão</summary>
            <ul className="modelo-evento__instrucoes">
              {c.envios.map((e, i) => (
                <li key={i}>
                  {e.etapa}: {textoUso(e.uso)} (estimativa do aplicativo: {numero(e.estimativa)})
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {ponto ? (
        <section aria-labelledby={`${base}-tarefa`}>
          <h3 id={`${base}-tarefa`} className="elementos__grupo">Tarefa: {ponto.titulo}</h3>
          <p>
            {concluidas} de {ponto.etapas.length} etapas concluídas. Ponto de retomada gravado em {new Date(ponto.atualizadoEm).toLocaleString('pt-BR')}
            {ponto.motivo === 'limite' ? ', com o limite perto' : ponto.motivo === 'falha' ? ', depois de uma falha no envio' : ''}.
          </p>
          {!so && (
            <div className="acoes">
              {etapasPendentes(ponto).length > 0 && executando === null && (
                <button type="button" className="btn-principal" disabled={!config.ativa} onClick={() => void pedirAutorizacao(ponto)}>
                  Retomar ({etapasPendentes(ponto).length} pendentes)
                </button>
              )}
              {executando !== null && (
                <button type="button" className="btn-secundario" onClick={() => (parar.current = true)}>
                  Pausar depois desta etapa
                </button>
              )}
              <button type="button" className="btn-secundario" disabled={executando !== null} onClick={() => void gravarPonto(null).then(() => setAnuncio('Tarefa descartada.'))}>
                Descartar a tarefa
              </button>
            </div>
          )}
          <ul className="elementos__lista assistente-ia__etapas">
            {ponto.etapas.map((e) => {
              if (e.estado === 'pendente') return <li key={e.chave}>{e.rotulo}: pendente</li>;
              if (e.estado !== 'concluida') return <li key={e.chave}>{e.rotulo}: sugestão {e.estado}</li>;
              if (ponto.operacao === 'revisarTabelas') {
                const s = lerSugestaoTabela(e.resposta ?? '');
                const t = p.tabelas.find((x) => x.id === e.chave);
                const escolhidos = camposEscolhidos[e.chave] ?? (['titulo', 'fonte', 'nota'] as const).filter((k) => s?.[k]);
                return (
                  <li key={e.chave} className="assistente-ia__sugestao">
                    <strong>{e.rotulo}</strong>
                    {!s || !t ? (
                      <p className="dica">{!t ? 'O elemento não está mais no trabalho.' : 'A resposta não veio no formato esperado.'}</p>
                    ) : (
                      <>
                        {(['titulo', 'fonte', 'nota'] as const).map((k) =>
                          s[k] ? (
                            <label key={k} className="tipos-trabalho__opcao">
                              <input
                                type="checkbox"
                                checked={escolhidos.includes(k)}
                                disabled={so}
                                onChange={(ev) => setCamposEscolhidos((x) => ({ ...x, [e.chave]: ev.target.checked ? [...escolhidos, k] : escolhidos.filter((y) => y !== k) }))}
                              />
                              <span>
                                {{ titulo: 'Título', fonte: 'Fonte', nota: 'Nota' }[k]}: “{s[k]}”
                              </span>
                            </label>
                          ) : null,
                        )}
                        {s.observacoes.length > 0 && (
                          <ul className="modelo-evento__instrucoes">
                            {s.observacoes.map((o, i) => (
                              <li key={i}>{o}</li>
                            ))}
                          </ul>
                        )}
                        {!s.titulo && !s.fonte && !s.nota && <p className="dica">Sem mudanças sugeridas.</p>}
                      </>
                    )}
                    {!so && (
                      <div className="acoes">
                        {s && t && escolhidos.length > 0 && (
                          <button
                            type="button"
                            className="btn-principal"
                            onClick={() => {
                              void decidir(e.chave, 'aplicada').then(() => p.aoAplicarTabela(t.id, dadosComSugestao(t.bloco, s, escolhidos)));
                            }}
                          >
                            Aplicar no texto
                          </button>
                        )}
                        <button type="button" className="btn-secundario" onClick={() => void decidir(e.chave, 'descartada')}>
                          Descartar
                        </button>
                      </div>
                    )}
                  </li>
                );
              }
              const s = lerSugestaoModelo(e.resposta ?? '');
              return (
                <li key={e.chave} className="assistente-ia__sugestao">
                  <strong>{e.rotulo}</strong>
                  {!s ? (
                    <p className="dica">A resposta não veio no formato esperado.</p>
                  ) : (
                    <>
                      <ul className="modelo-evento__instrucoes">
                        {Object.entries(s.regras).map(([k, v]) => (
                          <li key={k}>
                            {k}: {String(v)}
                          </li>
                        ))}
                        {s.observacoes.map((o, i) => (
                          <li key={`o${i}`}>{o}</li>
                        ))}
                      </ul>
                      {!so && Object.keys(s.regras).length > 0 && (
                        <button
                          type="button"
                          className="btn-principal"
                          onClick={() => {
                            const r = p.aoAplicarModelo(s.regras);
                            if (r.ok) void decidir(e.chave, 'aplicada');
                            setAnuncio(r.ok ? 'Sugestão aplicada ao modelo. Confira em Trabalho › Modelo de evento (DOCX)….' : r.mensagem);
                          }}
                        >
                          Aplicar ao modelo
                        </button>
                      )}
                    </>
                  )}
                  {!so && (
                    <button type="button" className="btn-secundario" onClick={() => void decidir(e.chave, 'descartada')}>
                      Descartar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <section aria-labelledby={`${base}-tarefas`}>
          <h3 id={`${base}-tarefas`} className="elementos__grupo">Tarefas</h3>
          {!so && (
            <div className="acoes">
              <button type="button" className="btn-secundario" disabled={!config.ativa || p.tabelas.length === 0} onClick={() => void iniciar('revisarTabelas')}>
                Revisar tabelas e quadros ({p.tabelas.length})
              </button>
              <button
                type="button"
                className="btn-secundario"
                disabled={!config.ativa || !p.modelo || (p.modelo.instrucoes ?? []).length === 0}
                onClick={() => void iniciar('interpretarModelo')}
              >
                Interpretar as instruções do modelo de evento
              </button>
            </div>
          )}
          {!config.ativa && <p className="dica">Ative a IA na configuração acima para usar as tarefas.</p>}
        </section>
      )}

      {executando !== null && (
        <p className="dica" role="status" aria-live="polite">
          {executando}
        </p>
      )}
      <p className="dica" role="status">
        {anuncio}
      </p>

      {autorizacao !== null && (
        <DialogoAutorizacao provedor={PROVEDORES.find((x) => x.id === config.provedor)?.nome ?? 'serviço'} pedidos={autorizacao.pedidos} aoEnviar={() => void executar(autorizacao)} aoCancelar={() => setAutorizacao(null)} />
      )}
    </div>
  );
}

/** Autorização com o conteúdo exato de cada envio (também usada pela ficha institucional). */
export function DialogoAutorizacao(p: { provedor: string; pedidos: readonly { chave: string; rotulo: string; pedido: PedidoIA }[]; aoEnviar: () => void; aoCancelar: () => void; rotuloConteudo?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const base = useId();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) {
      d.showModal();
      d.querySelector<HTMLButtonElement>('.btn-secundario')?.focus();
    }
    return () => d?.close();
  }, []);
  const estimativa = p.pedidos.reduce((n, x) => n + estimarPedido(x.pedido), 0);
  return (
    <dialog
      ref={ref}
      className="dialogo dialogo--largo"
      aria-labelledby={`${base}-titulo`}
      onCancel={(e) => {
        e.preventDefault();
        p.aoCancelar();
      }}
      onClose={aoFecharDialogo(p.aoCancelar)}
    >
      <div className="dialogo__corpo">
        <h2 id={`${base}-titulo`}>Autorizar o envio à IA</h2>
        <p>
          Será enviado a {p.provedor} exatamente o conteúdo abaixo ({p.pedidos.length} {p.pedidos.length === 1 ? 'envio' : 'envios'}; estimativa do aplicativo:
          cerca de {numero(estimativa)} tokens). Nada mais sai do computador.
        </p>
        <div className="lista-rolavel assistente-ia__conteudo" tabIndex={0} aria-label="Conteúdo que será enviado">
          {p.pedidos.map((x) => (
            <section key={x.chave}>
              <h3 className="elementos__grupo">{x.rotulo}</h3>
              {x.pedido.mensagens.map((m, i) => (
                <pre key={i} className="assistente-ia__mensagem">
                  {m.papel === 'sistema' ? '[instruções] ' : `[${p.rotuloConteudo ?? 'conteúdo do trabalho'}] `}
                  {m.texto}
                </pre>
              ))}
            </section>
          ))}
        </div>
        <div className="dialogo__acoes">
          <button type="button" className="btn-secundario" onClick={p.aoCancelar}>
            Cancelar
          </button>
          <button type="button" className="btn-principal" onClick={p.aoEnviar}>
            Autorizar e enviar
          </button>
        </div>
      </div>
    </dialog>
  );
}
