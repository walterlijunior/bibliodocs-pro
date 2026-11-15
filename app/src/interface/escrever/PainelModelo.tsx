/**
 * Modelo de congresso ou evento (Etapa 7 da especificação de atualização), na aba Elementos, no lugar do editor.
 *
 * - Importar o DOCX oficial: o que foi reconhecido aparece antes de aplicar (aspecto, no modelo, no trabalho,
 *   situação), com as instruções escritas no modelo, as seções dele e o que a exportação não reproduz.
 * - Aplicado: cada aspecto pode ser corrigido à mão ou voltar ao perfil; "Criar as seções que faltam" acrescenta as
 *   seções do modelo, vazias, no fim do texto; "Voltar ao perfil da UFT" tira o modelo. O texto nunca muda.
 * - "Conferir um DOCX exportado…": lê o arquivo exportado e lista o que ainda difere do modelo original.
 *
 * Texto sempre como texto (nunca HTML).
 */
import { useId, useRef, useState } from 'react';
import {
  ASPECTOS,
  aspectosComPerfilPadrao,
  conferirExportado,
  instituicaoDe,
  LIMITE_BYTES_MODELO,
  modeloDoArquivo,
  modeloDoPerfil,
  perfisAplicaveis,
  type ChaveAspecto,
  type DiferencaExportado,
  type ResultadoObra,
} from '../../aplicacao';
import type { EstiloTituloModelo, ModeloEvento, RegrasModelo, VinculoInstitucional } from '../../dominio/modelo';
import { useCatalogo } from '../catalogo/ContextoCatalogo';

export interface PropsPainelModelo {
  modelo: ModeloEvento | undefined;
  somenteLeitura: boolean;
  /** Quantas seções de nível 1 do modelo o trabalho ainda não tem. */
  secoesQueFaltam: readonly string[];
  aoAplicar: (m: ModeloEvento | null) => ResultadoObra;
  aoCriarSecoes: () => number;
  /** Etapa 3 (ficha institucional): de onde vieram os dados institucionais e o tipo do trabalho, para oferecer os perfis da instituição. */
  vinculo?: VinculoInstitucional | undefined;
  tipoTrabalho?: string | undefined;
}

const SITUACAO: Readonly<Record<string, string>> = {
  reconhecido: 'Reconhecido no modelo',
  corrigido: 'Corrigido por você',
  perfil: 'Não definido no modelo: vale o Manual da UFT',
  aproximado: 'Aproximado: confira',
};

const ALINHAMENTOS = [
  ['esquerda', 'À esquerda'],
  ['justificado', 'Justificado'],
  ['centralizado', 'Centralizado'],
  ['direita', 'À direita'],
] as const;

function resumoTitulo(t: EstiloTituloModelo): string {
  const partes = [
    t.corpoPt !== undefined ? `${String(t.corpoPt).replace('.', ',')} pt` : null,
    t.negrito ? 'negrito' : null,
    t.italico ? 'itálico' : null,
    t.maiusculas ? 'maiúsculas' : null,
    t.alinhamento ? ALINHAMENTOS.find((a) => a[0] === t.alinhamento)?.[1].toLowerCase() : null,
    t.quebraPagina ? 'em página nova' : null,
  ].filter((x): x is string => x !== null);
  return partes.join(', ') || 'sem destaque';
}

async function lerArquivo(arquivo: File): Promise<Uint8Array | string> {
  if (arquivo.size > LIMITE_BYTES_MODELO) return `“${arquivo.name}” passa de ${LIMITE_BYTES_MODELO / 1024 / 1024} MB.`;
  return new Uint8Array(await arquivo.arrayBuffer());
}

export function PainelModelo(p: PropsPainelModelo) {
  const base = useId();
  const so = p.somenteLeitura;
  const refImportar = useRef<HTMLInputElement>(null);
  const refConferir = useRef<HTMLInputElement>(null);
  // Modelo lido e ainda não aplicado (prévia).
  const [previa, setPrevia] = useState<ModeloEvento | null>(null);
  const [anuncio, setAnuncio] = useState<string | null>(null);
  const [diferencas, setDiferencas] = useState<{ arquivo: string; lista: readonly DiferencaExportado[] } | null>(null);
  const [edicao, setEdicao] = useState<Partial<Record<ChaveAspecto, string>>>({});

  const { catalogo } = useCatalogo();
  const instituicao = instituicaoDe(catalogo, p.vinculo?.instituicao);
  const perfis = perfisAplicaveis(instituicao, p.vinculo?.curso, p.tipoTrabalho);

  const mostrado = previa ?? p.modelo ?? null;
  const aplicado = previa === null && p.modelo !== undefined;

  const importar = async (arquivo: File | undefined) => {
    if (!arquivo) return;
    const lido = await lerArquivo(arquivo);
    if (typeof lido === 'string') return setAnuncio(lido);
    const r = modeloDoArquivo(arquivo.name, lido, new Date());
    if (!r.ok) return setAnuncio(`“${arquivo.name}”: ${r.mensagem}`);
    setPrevia(r.modelo);
    setDiferencas(null);
    setAnuncio(`Modelo “${r.modelo.nome}” lido. Confira o que foi reconhecido e aplique ao trabalho.`);
  };

  const conferir = async (arquivo: File | undefined) => {
    if (!arquivo || !p.modelo) return;
    const lido = await lerArquivo(arquivo);
    if (typeof lido === 'string') return setAnuncio(lido);
    const r = conferirExportado(p.modelo, lido);
    if (!r.ok) return setAnuncio(`“${arquivo.name}”: ${r.mensagem}`);
    setDiferencas({ arquivo: arquivo.name, lista: r.diferencas });
    setAnuncio(null);
  };

  const trocarRegra = (chave: ChaveAspecto, valor: RegrasModelo[ChaveAspecto] | undefined) => {
    if (!p.modelo) return;
    const { [chave]: _antigo, ...resto } = p.modelo.regras;
    const r = p.aoAplicar({ ...p.modelo, regras: valor === undefined ? resto : { ...resto, [chave]: valor } });
    setAnuncio(r.ok ? null : r.mensagem);
  };

  const confirmarNumero = (chave: ChaveAspecto) => {
    const texto = edicao[chave];
    if (texto === undefined) return;
    setEdicao(({ [chave]: _x, ...e }) => e);
    const n = Number(texto.replace(',', '.'));
    if (texto.trim() === '' || !Number.isFinite(n)) return setAnuncio('Use um número, como 2,5.');
    trocarRegra(chave, n);
  };

  return (
    <div className="gerenciador modelo-evento" aria-labelledby={`${base}-titulo`}>
      <h2 id={`${base}-titulo`}>Modelo de congresso ou evento</h2>
      <input
        ref={refImportar}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        hidden
        aria-label="Arquivo DOCX do modelo"
        onChange={(e) => {
          void importar(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={refConferir}
        type="file"
        accept=".docx"
        hidden
        aria-label="DOCX exportado para conferir"
        onChange={(e) => {
          void conferir(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {mostrado === null ? (
        <>
          <p>
            Importe o DOCX oficial do evento (artigo, resumo expandido, relato de experiência). O aplicativo lê margens, fonte, espaçamento, alinhamento,
            estilos de título e seções, e mostra o que reconheceu antes de aplicar. O seu texto não muda.
          </p>
          {!so && (
            <button type="button" className="btn-principal" onClick={() => refImportar.current?.click()}>
              Importar modelo DOCX…
            </button>
          )}
        </>
      ) : (
        <>
          <p className="dica">
            {aplicado
              ? `Modelo “${mostrado.nome}” aplicado ao trabalho. A exportação usa estes valores; o que o modelo não define segue o Manual da UFT.`
              : `Prévia do modelo “${mostrado.nome}”: ainda não aplicado.`}
          </p>
          <table className="registro__tabela modelo-evento__tabela">
            <caption className="sr-only">Formatação do modelo</caption>
            <thead>
              <tr>
                <th scope="col">Aspecto</th>
                <th scope="col">No modelo</th>
                <th scope="col">No trabalho</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {aspectosComPerfilPadrao(mostrado).map((l) => {
                const a = ASPECTOS.find((x) => x.chave === l.chave)!;
                const valor = mostrado.regras[l.chave];
                const editavel = aplicado && !so;
                return (
                  <tr key={l.chave}>
                    <th scope="row">{l.rotulo}</th>
                    <td>{l.noModelo ?? '—'}</td>
                    <td>
                      {!editavel ? (
                        l.noTrabalho
                      ) : a.tipo === 'entrelinha' ? (
                        <select className="campo" aria-label={`${l.rotulo} no trabalho`} value={(valor as string | undefined) ?? ''} onChange={(e) => trocarRegra(l.chave, e.target.value === '' ? undefined : (e.target.value as RegrasModelo['entrelinha']))}>
                          <option value="">Do Manual da UFT</option>
                          <option value="simples">Simples</option>
                          <option value="1,5">1,5</option>
                          <option value="duplo">Dupla</option>
                        </select>
                      ) : a.tipo === 'alinhamento' ? (
                        <select className="campo" aria-label={`${l.rotulo} no trabalho`} value={(valor as string | undefined) ?? ''} onChange={(e) => trocarRegra(l.chave, e.target.value === '' ? undefined : (e.target.value as RegrasModelo['alinhamento']))}>
                          <option value="">Do Manual da UFT</option>
                          {ALINHAMENTOS.map(([v, n]) => (
                            <option key={v} value={v}>
                              {n}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="modelo-evento__valor">
                          <input
                            className="campo"
                            aria-label={`${l.rotulo} no trabalho${a.unidade ? ` (${a.unidade})` : ''}`}
                            value={edicao[l.chave] ?? (valor === undefined ? '' : String(valor).replace('.', a.tipo === 'numero' ? ',' : '.'))}
                            placeholder={l.noTrabalho}
                            onChange={(e) => setEdicao((x) => ({ ...x, [l.chave]: e.target.value }))}
                            onBlur={() => {
                              if (a.tipo === 'numero') confirmarNumero(l.chave);
                              else {
                                const t = edicao[l.chave];
                                setEdicao(({ [l.chave]: _x, ...e }) => e);
                                if (t !== undefined) trocarRegra(l.chave, t.trim() === '' ? undefined : t.trim());
                              }
                            }}
                          />
                          {a.unidade}
                        </span>
                      )}
                    </td>
                    <td>{SITUACAO[l.situacao]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {(['titulo1', 'titulo2', 'titulo3'] as const).some((k) => mostrado.regras[k]) && (
            <section aria-labelledby={`${base}-titulos`}>
              <h3 id={`${base}-titulos`} className="elementos__grupo">Estilos de título</h3>
              <ul className="elementos__lista">
                {(['titulo1', 'titulo2', 'titulo3'] as const).map((k, i) =>
                  mostrado.regras[k] ? <li key={k}>Título {i + 1} (seção {['1', '1.1', '1.1.1'][i]}): {resumoTitulo(mostrado.regras[k]!)}</li> : null,
                )}
              </ul>
            </section>
          )}

          <section aria-labelledby={`${base}-secoes`}>
            <h3 id={`${base}-secoes`} className="elementos__grupo">Seções do modelo</h3>
            {(mostrado.secoes ?? []).length === 0 ? (
              <p className="dica">O modelo não marca seções com estilo de título.</p>
            ) : (
              <ul className="elementos__lista">
                {(mostrado.secoes ?? []).map((s, i) => (
                  <li key={i} style={{ paddingLeft: `${(s.nivel - 1) * 1.5}em` }}>
                    {s.titulo}
                  </li>
                ))}
              </ul>
            )}
            {aplicado && !so && p.secoesQueFaltam.length > 0 && (
              <button
                type="button"
                className="btn-secundario"
                onClick={() => {
                  const n = p.aoCriarSecoes();
                  setAnuncio(n > 0 ? `${n === 1 ? '1 seção criada' : `${n} seções criadas`} no fim do texto, vazias. O histórico do trabalho guarda o estado de antes.` : 'Nenhuma seção criada.')
                }}
              >
                Criar as seções que faltam ({p.secoesQueFaltam.join(', ')})
              </button>
            )}
          </section>

          {(mostrado.instrucoes ?? []).length > 0 && (
            <section aria-labelledby={`${base}-instrucoes`}>
              <h3 id={`${base}-instrucoes`} className="elementos__grupo">Instruções escritas no modelo (confira à mão)</h3>
              <p className="dica">O aplicativo não interpreta estas frases sozinho: limite de páginas, de palavras e outras exigências ficam com você.</p>
              <ul className="modelo-evento__instrucoes">
                {(mostrado.instrucoes ?? []).map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </section>
          )}

          {(mostrado.avisos ?? []).length > 0 && (
            <section aria-labelledby={`${base}-avisos`}>
              <h3 id={`${base}-avisos`} className="elementos__grupo">O que a exportação não reproduz</h3>
              <ul className="modelo-evento__instrucoes">
                {(mostrado.avisos ?? []).map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </section>
          )}

          <div className="acoes">
            {previa !== null && !so && (
              <>
                <button
                  type="button"
                  className="btn-principal"
                  onClick={() => {
                    const r = p.aoAplicar(previa);
                    if (r.ok) {
                      setPrevia(null);
                      setAnuncio(`Modelo “${previa.nome}” aplicado. O texto não mudou; Trabalho › Histórico do trabalho… guarda o estado de antes.`);
                    } else setAnuncio(r.mensagem);
                  }}
                >
                  Aplicar ao trabalho
                </button>
                <button type="button" className="btn-secundario" onClick={() => { setPrevia(null); setAnuncio(null); }}>
                  Cancelar
                </button>
              </>
            )}
            {aplicado && (
              <>
                <button type="button" className="btn-secundario" onClick={() => refConferir.current?.click()}>
                  Conferir um DOCX exportado…
                </button>
                {!so && (
                  <>
                    <button type="button" className="btn-secundario" onClick={() => refImportar.current?.click()}>
                      Importar outro modelo…
                    </button>
                    <button
                      type="button"
                      className="btn-secundario"
                      onClick={() => {
                        const r = p.aoAplicar(null);
                        setDiferencas(null);
                        setAnuncio(r.ok ? 'O trabalho voltou ao perfil da UFT.' : r.mensagem);
                      }}
                    >
                      Voltar ao perfil da UFT
                    </button>
                  </>
                )}
              </>
            )}
          </div>

          {diferencas !== null && (
            <section aria-labelledby={`${base}-diferencas`}>
              <h3 id={`${base}-diferencas`} className="elementos__grupo">Exportado × modelo (“{diferencas.arquivo}”)</h3>
              {diferencas.lista.length === 0 ? (
                <p>Margens, fonte, texto, títulos e seções do exportado conferem com o modelo.</p>
              ) : (
                <table className="registro__tabela">
                  <thead>
                    <tr>
                      <th scope="col">Aspecto</th>
                      <th scope="col">No modelo</th>
                      <th scope="col">No exportado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diferencas.lista.map((d, i) => (
                      <tr key={i}>
                        <th scope="row">{d.aspecto}</th>
                        <td>{d.noModelo}</td>
                        <td>{d.noExportado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          )}
        </>
      )}
      {!so && previa === null && instituicao && perfis.length > 0 && (
        <section aria-labelledby={`${base}-perfis`}>
          <h3 id={`${base}-perfis`} className="elementos__grupo">Perfis de formatação da {instituicao.sigla}</h3>
          <p className="dica">Perfis da ficha institucional que valem para o curso e o tipo deste trabalho. O perfil passa pela mesma prévia de um modelo.</p>
          <ul className="elementos__lista">
            {perfis.map((pf) => (
              <li key={pf.id}>
                {pf.nome}{' '}
                {pf.revisado ? (
                  <button
                    type="button"
                    className="btn-link"
                    onClick={() => {
                      setPrevia(modeloDoPerfil(pf, instituicao, new Date()));
                      setDiferencas(null);
                      setAnuncio(`Perfil “${pf.nome}” lido. Confira as regras e aplique ao trabalho.`);
                    }}
                  >
                    Usar este perfil
                  </button>
                ) : (
                  <span className="dica">(ainda não revisado: confira em Catálogo acadêmico… › Ficha institucional)</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="dica" role="status">
        {anuncio}
      </p>
    </div>
  );
}
