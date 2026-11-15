/**
 * Ficha institucional no catálogo acadêmico (Etapa 3 da especificação de atualização, "Ficha institucional, contribuições
 * e importação"):
 *
 * - Exportar a ficha da instituição escolhida (`.bdficha.json`) para outra pessoa importar.
 * - Baixar o modelo de preenchimento (uma ficha de exemplo, com um registro de cada tipo).
 * - Importar uma ficha: a prévia mostra o que entra ou muda, os vínculos novos, os campos que faltam, os conflitos com o
 *   catálogo (o valor do catálogo fica até o usuário marcar a substituição) e as pendências (escolha numa ambiguidade;
 *   relação incompleta não entra). Nada vai para o catálogo antes de "Incluir no catálogo"; mesmo depois, só "Guardar"
 *   grava neste computador.
 * - Manuais e perfis da instituição: cada perfil mostra as regras e a fonte, e só pode ser usado num trabalho depois de
 *   marcado como revisado.
 *
 * - Preencher com IA (opcional, só com a IA configurada): o autor cola o texto da página oficial ou do manual, ou abre um
 *   arquivo de texto, e informa o endereço de onde veio; o envio mostra o conteúdo exato antes; a ficha sugerida passa
 *   pela mesma prévia, com o trecho de origem de cada sugestão e o que a IA marcou como incerto.
 *
 * O arquivo é lido como texto no renderer e validado pelo esquema (`lerFicha`); texto sempre como texto (nunca HTML).
 */
import { useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  aspectosComPerfilPadrao,
  estimarPedido,
  LIMITE_TEXTO_FICHA_IA,
  lerSugestaoFicha,
  pedidoPreencherFicha,
  PROVEDORES,
  textoDoArquivoFicha,
  TITULO_PREENCHER_FICHA,
  type ApiIa,
  type OrigemSugestao,
  type PedidoIA,
  BYTES_MAX_FICHA,
  fichaDoCatalogo,
  fichaModelo,
  importarFicha,
  lerFicha,
  modeloDoPerfil,
  nomeArquivoFicha,
  textoDaFicha,
  type ApiCatalogo,
  type Catalogo,
  type DecisoesImportacao,
  type FichaInstitucional as Ficha,
  type Instituicao,
  type ItemPrevia,
  type PerfilInstitucional,
} from '../../aplicacao';
import { consumo } from '../ia/consumo';
import { DialogoAutorizacao } from '../ia/PainelIA';

export interface PropsFichaInstitucional {
  catalogo: Catalogo;
  instituicao: Instituicao | undefined;
  api: ApiCatalogo | undefined;
  /** Serviço de IA (opcional): sem ele, "Preencher com IA…" não aparece. */
  ia?: ApiIa | undefined;
  /** Troca o catálogo da janela (ainda não guardado). */
  aoTrocar: (novo: Catalogo) => void;
  /** Depois da importação: escolhe a instituição importada no catálogo. */
  aoEscolherInstituicao: (id: string) => void;
}

const NIVEL: Readonly<Record<ItemPrevia['nivel'], string>> = {
  instituicao: 'Instituição',
  campus: 'Câmpus ou polo',
  curso: 'Curso ou programa',
  disciplina: 'Disciplina',
  docente: 'Docente',
  manual: 'Manual',
  perfil: 'Perfil de formatação',
};
const ACAO: Readonly<Record<ItemPrevia['acao'], string>> = { incluir: 'Incluir', atualizar: 'Atualizar', 'sem-mudanca': 'Já existe' };
const CAMPO: Readonly<Record<string, string>> = {
  cidade: 'cidade',
  uf: 'UF',
  grau: 'grau',
  areaConcentracao: 'área de concentração',
  titulacao: 'titulação',
  edicao: 'edição',
  data: 'data',
  logotipo: 'logotipo',
};

function Revisao(p: { perfil: PerfilInstitucional; instituicao: Instituicao }) {
  const modelo = useMemo(() => modeloDoPerfil(p.perfil, p.instituicao, new Date()), [p.perfil, p.instituicao]);
  const linhas = aspectosComPerfilPadrao(modelo).filter((l) => l.situacao !== 'perfil');
  return (
    <div className="ficha__regras">
      <p className="dica">{modelo.instrucoes?.[0]}</p>
      {linhas.length === 0 ? (
        <p className="dica">O perfil não muda nenhum aspecto: vale o perfil base do aplicativo.</p>
      ) : (
        <table className="registro__tabela">
          <caption className="sr-only">Regras do perfil {p.perfil.nome}</caption>
          <thead>
            <tr>
              <th scope="col">Aspecto</th>
              <th scope="col">No perfil</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.chave}>
                <th scope="row">{l.rotulo}</th>
                <td>{l.noTrabalho}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {(p.perfil.instrucoes ?? []).length > 0 && (
        <>
          <p className="dica">Instruções do manual que o aplicativo não aplica sozinho:</p>
          <ul className="modelo-evento__instrucoes">
            {p.perfil.instrucoes!.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function FichaInstitucional(p: PropsFichaInstitucional) {
  const base = useId();
  const refArquivo = useRef<HTMLInputElement>(null);
  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [lida, setLida] = useState<{ nome: string; ficha: Ficha } | null>(null);
  const [decisoes, setDecisoes] = useState<DecisoesImportacao>({});
  const [perfilAberto, setPerfilAberto] = useState<string | null>(null);
  // Preenchimento com IA.
  const refTexto = useRef<HTMLInputElement>(null);
  const [iaAberta, setIaAberta] = useState(false);
  const [iaTexto, setIaTexto] = useState('');
  const [iaUrl, setIaUrl] = useState('');
  const [iaArquivo, setIaArquivo] = useState<string | null>(null);
  const [iaPedido, setIaPedido] = useState<{ pedido: PedidoIA; provedor: string } | null>(null);
  const [iaEnviando, setIaEnviando] = useState(false);
  const [sugestao, setSugestao] = useState<{ origens: OrigemSugestao[]; observacoes: string[] } | null>(null);
  const inst = p.instituicao;

  const resultado = useMemo(() => (lida ? importarFicha(p.catalogo, lida.ficha, decisoes) : null), [lida, p.catalogo, decisoes]);

  const exportar = async (ficha: Ficha, nome: string, oQue: string) => {
    if (!p.api) return setAnuncio('Exportar a ficha só funciona no aplicativo instalado.');
    try {
      const r = await p.api.exportarFicha(textoDaFicha(ficha), nome);
      if (r.ok) setAnuncio(`${oQue} gravado em “${r.nome}”.`);
      else if (!r.cancelado) setAnuncio(r.mensagem);
    } catch {
      setAnuncio('Não foi possível exportar a ficha.');
    }
  };

  const abrir = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    if (arquivo.size > BYTES_MAX_FICHA) return setAnuncio(`“${arquivo.name}” passa de ${BYTES_MAX_FICHA / 1024 / 1024} MB.`);
    const r = lerFicha(await arquivo.text());
    if (!r.ok) return setAnuncio(`“${arquivo.name}”: ${r.mensagem}`);
    setLida({ nome: arquivo.name, ficha: r.ficha });
    setSugestao(null);
    setDecisoes({});
    setAnuncio(`Ficha “${arquivo.name}” lida. Confira a prévia antes de incluir no catálogo.`);
  };

  const urlValida = iaUrl.trim() === '' || /^https:\/\/[^\s]+$/.test(iaUrl.trim());
  const entradaIa = () => ({
    texto: iaTexto,
    ...(iaUrl.trim() ? { url: iaUrl.trim() } : {}),
    ...(iaArquivo ? { arquivo: iaArquivo } : {}),
    ...(inst ? { instituicao: { nome: inst.nome, sigla: inst.sigla } } : {}),
  });

  const abrirTexto = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    if (arquivo.size > 5 * 1024 * 1024) return setAnuncio(`“${arquivo.name}” passa de 5 MB.`);
    const texto = textoDoArquivoFicha(arquivo.name, await arquivo.text());
    setIaTexto(texto.slice(0, LIMITE_TEXTO_FICHA_IA));
    setIaArquivo(arquivo.name);
    setAnuncio(
      texto.length > LIMITE_TEXTO_FICHA_IA
        ? `“${arquivo.name}” foi cortado em ${LIMITE_TEXTO_FICHA_IA.toLocaleString('pt-BR')} caracteres: envie o restante numa segunda vez.`
        : `Texto de “${arquivo.name}” carregado.`,
    );
  };

  const pedirAutorizacao = async () => {
    if (!p.ia) return;
    try {
      const cfg = await p.ia.lerConfig();
      const provedor = PROVEDORES.find((x) => x.id === cfg.provedor);
      if (!cfg.ativa) return setAnuncio('A IA está desativada. Ative-a em Trabalho › Assistente de IA… ou preencha a ficha à mão.');
      if (provedor?.exigeChave && !cfg.temChave) return setAnuncio('Falta a chave de API do serviço de IA: informe-a em Trabalho › Assistente de IA….');
      setIaPedido({ pedido: pedidoPreencherFicha(entradaIa()), provedor: provedor?.nome ?? 'serviço de IA' });
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
      if (!r.ok) return setAnuncio(`${r.mensagem} Nada foi alterado.`);
      consumo.registrar({ em: new Date().toISOString(), operacao: TITULO_PREENCHER_FICHA, etapa: inst ? inst.sigla : 'nova instituição', uso: r.uso, estimativa: estimarPedido(pedido) }, r.limites, r.usoMes);
      const hoje = new Date();
      const dia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
      const s = lerSugestaoFicha(r.texto, entradaIa(), dia);
      if (!s.ok) return setAnuncio(s.mensagem);
      setLida({ nome: 'sugestão da IA', ficha: s.ficha });
      setSugestao({ origens: s.origens, observacoes: s.observacoes });
      setDecisoes({});
      setIaAberta(false);
      setAnuncio('Sugestão da IA pronta. Confira a origem de cada item e a prévia antes de incluir no catálogo.');
    } catch {
      setAnuncio('Não foi possível falar com o serviço de IA. Nada foi alterado.');
    } finally {
      setIaEnviando(false);
    }
  };

  const escolher = (pendencia: string, valor: string) =>
    setDecisoes((d) => {
      const { [pendencia]: _x, ...resto } = d.escolhas ?? {};
      return { ...d, escolhas: valor === '' ? resto : { ...resto, [pendencia]: valor } };
    });
  const marcarSubstituir = (conflito: string, sim: boolean) =>
    setDecisoes((d) => {
      const atuais = new Set(d.substituir ?? []);
      if (sim) atuais.add(conflito);
      else atuais.delete(conflito);
      return { ...d, substituir: [...atuais] };
    });

  const incluir = () => {
    if (!resultado || resultado.previa.aguardaRevisao) return;
    p.aoTrocar(resultado.catalogo);
    if (resultado.instituicao) p.aoEscolherInstituicao(resultado.instituicao);
    setLida(null);
    setSugestao(null);
    setAnuncio('Ficha incluída no catálogo. Confira os registros e use “Guardar” para valer neste computador.');
  };

  const revisar = (perfil: PerfilInstitucional, revisado: boolean) => {
    if (!inst) return;
    const perfis = (inst.perfisInstitucionais ?? []).map((x) => (x.id === perfil.id ? { ...x, revisado } : x));
    p.aoTrocar({ ...p.catalogo, instituicoes: p.catalogo.instituicoes.map((i) => (i.id === inst.id ? { ...i, perfisInstitucionais: perfis } : i)) });
  };

  const previa = resultado?.previa;
  const mudancas = previa?.itens.filter((i) => i.acao !== 'sem-mudanca') ?? [];
  const iguais = (previa?.itens.length ?? 0) - mudancas.length;

  return (
    <fieldset className="catalogo__lista ficha" aria-labelledby={`${base}-titulo`}>
      <legend id={`${base}-titulo`}>Ficha institucional</legend>
      <p className="dica">
        Compartilhe os dados de uma instituição (câmpus, cursos, disciplinas, docentes, manuais e perfis de formatação) num arquivo que outra pessoa importa no
        BiblioDocs Pro.
      </p>
      <input
        ref={refArquivo}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="Arquivo da ficha institucional"
        onChange={(e) => {
          void abrir(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <div className="acoes">
        <button type="button" className="btn-secundario" onClick={() => refArquivo.current?.click()}>
          Importar ficha…
        </button>
        {inst && (
          <button
            type="button"
            className="btn-secundario"
            onClick={() => {
              const f = fichaDoCatalogo(p.catalogo, inst.id, new Date());
              if (f) void exportar(f, nomeArquivoFicha(f), `A ficha da ${inst.sigla} foi`);
            }}
          >
            Exportar ficha da {inst.sigla}…
          </button>
        )}
        {p.ia && (
          <button type="button" className="btn-secundario" aria-expanded={iaAberta} onClick={() => setIaAberta((a) => !a)}>
            Preencher com IA…
          </button>
        )}
        <button type="button" className="btn-secundario" onClick={() => void exportar(fichaModelo(), 'ficha-modelo.bdficha.json', 'O modelo de preenchimento foi')}>
          Modelo de preenchimento…
        </button>
      </div>

      {iaAberta && p.ia && (
        <section className="ficha__previa" aria-labelledby={`${base}-ia`}>
          <h3 id={`${base}-ia`} className="elementos__grupo">
            Preencher com IA{inst ? ` (${inst.sigla})` : ''}
          </h3>
          <p className="dica">
            Cole o texto da página oficial ou do manual, ou abra um arquivo de texto ou HTML salvo da página. O aplicativo não acessa o endereço: ele só fica
            registrado como fonte. A IA sugere câmpus, cursos, disciplinas, docentes, manuais e regras do perfil; tudo passa pela prévia, e o perfil chega sem
            revisão.{inst ? '' : ' Sem instituição escolhida acima, a IA identifica a instituição pelo texto.'}
          </p>
          <input
            ref={refTexto}
            type="file"
            accept=".txt,.md,.html,.htm,text/plain,text/html"
            hidden
            aria-label="Arquivo de texto para a IA"
            onChange={(e) => {
              void abrirTexto(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <div className="campo-catalogo">
            <label htmlFor={`${base}-ia-url`}>Endereço da fonte (https)</label>
            <input
              id={`${base}-ia-url`}
              className="campo"
              type="url"
              value={iaUrl}
              placeholder="https://www.instituicao.edu.br/cursos"
              aria-invalid={!urlValida || undefined}
              onChange={(e) => setIaUrl(e.target.value)}
            />
            {!urlValida && <span className="dica dica--erro">Use um endereço que comece com https://.</span>}
          </div>
          <div className="campo-catalogo">
            <label htmlFor={`${base}-ia-texto`}>Texto da fonte</label>
            <textarea
              id={`${base}-ia-texto`}
              className="campo"
              rows={6}
              maxLength={LIMITE_TEXTO_FICHA_IA}
              value={iaTexto}
              onChange={(e) => {
                setIaTexto(e.target.value);
                setIaArquivo(null);
              }}
            />
            <span className="dica">
              {iaTexto.length.toLocaleString('pt-BR')} de {LIMITE_TEXTO_FICHA_IA.toLocaleString('pt-BR')} caracteres{iaArquivo ? ` (de “${iaArquivo}”)` : ''}.
            </span>
          </div>
          <div className="acoes">
            <button type="button" className="btn-secundario" onClick={() => refTexto.current?.click()}>
              Abrir arquivo de texto…
            </button>
            <button type="button" className="btn-principal" disabled={iaTexto.trim() === '' || !urlValida || iaEnviando} onClick={() => void pedirAutorizacao()}>
              Enviar à IA…
            </button>
          </div>
        </section>
      )}
      {iaPedido &&
        createPortal(
          <DialogoAutorizacao
            provedor={iaPedido.provedor}
            pedidos={[{ chave: 'ficha', rotulo: TITULO_PREENCHER_FICHA, pedido: iaPedido.pedido }]}
            rotuloConteudo="texto da fonte"
            aoEnviar={() => void enviarIa(iaPedido.pedido)}
            aoCancelar={() => {
              setIaPedido(null);
              setAnuncio('Envio cancelado. Nada saiu do computador.');
            }}
          />,
          document.body,
        )}

      {lida && previa && (
        <section className="ficha__previa" aria-labelledby={`${base}-previa`}>
          <h3 id={`${base}-previa`} className="elementos__grupo">
            Prévia da importação de “{lida.nome}”
          </h3>
          {previa.semMudancas ? (
            <p>Tudo o que a ficha traz já está no catálogo: nada será incluído nem alterado.</p>
          ) : (
            <p>
              {mudancas.length === 1 ? '1 registro será incluído ou atualizado' : `${mudancas.length} registros serão incluídos ou atualizados`}
              {iguais > 0 ? `; ${iguais === 1 ? '1 já existe' : `${iguais} já existem`} e fica como está` : ''}. {previa.vinculosPreservados > 0 ? `${previa.vinculosPreservados} vínculo(s) já existente(s) preservado(s).` : ''}
            </p>
          )}

          {sugestao && (
            <div role="group" aria-labelledby={`${base}-origens`}>
              <h4 id={`${base}-origens`}>Origem das sugestões da IA</h4>
              <p className="dica">
                {sugestao.origens.some((o) => o.incerto)
                  ? `${sugestao.origens.filter((o) => o.incerto).length} sugestão(ões) marcada(s) pela IA como incerta(s): confira na fonte antes de incluir.`
                  : 'Confira cada item na fonte antes de incluir.'}
              </p>
              <ul className="ficha__itens">
                {sugestao.origens.map((o, k) => (
                  <li key={k}>
                    {o.incerto && <strong>Incerto: </strong>}
                    {o.rotulo}
                    {o.trecho ? ` — “${o.trecho}”` : ' — sem trecho citado'}
                  </li>
                ))}
              </ul>
              {sugestao.observacoes.length > 0 && (
                <ul className="modelo-evento__instrucoes">
                  {sugestao.observacoes.map((t, k) => (
                    <li key={k}>{t}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {previa.pendencias.length > 0 && (
            <div role="group" aria-labelledby={`${base}-pendencias`}>
              <h4 id={`${base}-pendencias`}>Pendências para revisar</h4>
              <ul className="ficha__pendencias">
                {previa.pendencias.map((x) => (
                  <li key={x.id}>
                    {x.tipo === 'ambigua' && x.opcoes ? (
                      <label>
                        {x.mensagem}{' '}
                        <select className="campo" value={x.escolha ?? ''} onChange={(e) => escolher(x.id, e.target.value)}>
                          <option value="">Escolha…</option>
                          {x.opcoes.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.rotulo}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <span>{x.mensagem} (não será incluído)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {previa.conflitos.length > 0 && (
            <div role="group" aria-labelledby={`${base}-conflitos`}>
              <h4 id={`${base}-conflitos`}>Valores diferentes do catálogo</h4>
              <p className="dica">O valor do catálogo continua, a menos que você marque a substituição.</p>
              <table className="registro__tabela">
                <thead>
                  <tr>
                    <th scope="col">Registro</th>
                    <th scope="col">Campo</th>
                    <th scope="col">No catálogo</th>
                    <th scope="col">Na ficha</th>
                    <th scope="col">Usar o da ficha</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.conflitos.map((c) => (
                    <tr key={c.id}>
                      <th scope="row">{c.rotulo}</th>
                      <td>{CAMPO[c.campo] ?? c.campo}</td>
                      <td>{c.noCatalogo}</td>
                      <td>{c.naFicha}</td>
                      <td>
                        <input type="checkbox" aria-label={`Usar o valor da ficha em ${c.rotulo}, ${CAMPO[c.campo] ?? c.campo}`} checked={c.substituir} onChange={(e) => marcarSubstituir(c.id, e.target.checked)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {mudancas.length > 0 && (
            <div role="group" aria-labelledby={`${base}-itens`}>
              <h4 id={`${base}-itens`}>O que entra ou muda</h4>
              <ul className="ficha__itens">
                {mudancas.map((i, k) => (
                  <li key={k}>
                    {ACAO[i.acao]} — {NIVEL[i.nivel]}: {i.rotulo}
                    {i.detalhe ? ` (${i.detalhe})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {previa.vinculosNovos.length > 0 && (
            <div role="group" aria-labelledby={`${base}-vinculos`}>
              <h4 id={`${base}-vinculos`}>Vínculos que serão criados</h4>
              <ul className="ficha__itens">
                {previa.vinculosNovos.map((v, k) => (
                  <li key={k}>
                    {v.de} → {v.para}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {previa.faltantes.length > 0 && (
            <div role="group" aria-labelledby={`${base}-faltantes`}>
              <h4 id={`${base}-faltantes`}>Campos que a ficha não traz</h4>
              <ul className="ficha__itens">
                {previa.faltantes.map((f, k) => (
                  <li key={k}>
                    {f.rotulo}: {CAMPO[f.campo] ?? f.campo}
                    {f.desconhecido ? ' (marcado como desconhecido por quem preencheu)' : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="acoes">
            <button type="button" className="btn-principal" disabled={previa.aguardaRevisao || previa.semMudancas} onClick={incluir}>
              Incluir no catálogo
            </button>
            <button
              type="button"
              className="btn-secundario"
              onClick={() => {
                setLida(null);
                setSugestao(null);
                setAnuncio('Importação cancelada. O catálogo não mudou.');
              }}
            >
              Cancelar importação
            </button>
          </div>
          {previa.aguardaRevisao && <p className="dica">Resolva as pendências marcadas para incluir.</p>}
        </section>
      )}

      {inst && ((inst.manuais ?? []).length > 0 || (inst.perfisInstitucionais ?? []).length > 0) && (
        <section aria-labelledby={`${base}-manuais`}>
          <h3 id={`${base}-manuais`} className="elementos__grupo">
            Manuais e perfis da {inst.sigla}
          </h3>
          {(inst.manuais ?? []).length > 0 && (
            <ul className="ficha__itens">
              {inst.manuais!.map((m) => (
                <li key={m.id}>
                  {m.titulo}
                  {m.edicao ? `, ${m.edicao}` : ''}
                  {m.data ? ` (${m.data})` : ''}
                  {m.url ? ` — ${m.url.replace(/^https:\/\//, '')}` : m.arquivo ? ` — arquivo ${m.arquivo}` : ' — sem fonte confirmada'}
                </li>
              ))}
            </ul>
          )}
          {(inst.perfisInstitucionais ?? []).map((pf) => (
            <div key={pf.id} className="ficha__perfil">
              <p>
                <strong>{pf.nome}</strong> — {pf.revisado ? 'revisado: pode ser usado nos trabalhos.' : 'ainda não revisado: confira as regras antes de usar.'}
              </p>
              <div className="acoes">
                <button type="button" className="btn-link" aria-expanded={perfilAberto === pf.id} onClick={() => setPerfilAberto(perfilAberto === pf.id ? null : pf.id)}>
                  {perfilAberto === pf.id ? 'Ocultar as regras' : 'Ver as regras'}
                </button>
                <button type="button" className="btn-secundario" onClick={() => revisar(pf, !pf.revisado)}>
                  {pf.revisado ? 'Desfazer a revisão' : 'Marcar como revisado'}
                </button>
              </div>
              {perfilAberto === pf.id && <Revisao perfil={pf} instituicao={inst} />}
            </div>
          ))}
        </section>
      )}
      <p className="dica" role="status">
        {anuncio}
      </p>
    </fieldset>
  );
}
