// Coleções da Biblioteca (F-E6-01): Referências, Figuras e Tabelas e Siglas de todos os trabalhos da pasta, com o
// trabalho de origem e "Abrir"; Modelos mostra os tipos de trabalho do perfil UFT, com "Criar trabalho". Só texto.
import { useMemo } from 'react';
import type { IdentificadorItem } from '../../aplicacao';
import type { TipoTrabalhoUft } from '../../dominio/modelo';
import { entradasDaColecao, NOMES_COLECAO, type ColecaoConteudo } from './colecoes';
import { aplicarFiltro, ROTULOS_TIPO, TIPOS_NOVO_TRABALHO, type Filtro } from './selecao';
import type { EstadoBiblioteca } from './useBiblioteca';

export interface PropsAreaColecao {
  colecao: ColecaoConteudo | 'modelos';
  estado: EstadoBiblioteca;
  filtro: Filtro;
  busca: string;
  ocupado: boolean;
  aoAbrir: (id: IdentificadorItem) => void;
  aoCriar: (tipo: TipoTrabalhoUft) => void;
}

export function AreaColecao(p: PropsAreaColecao) {
  if (p.colecao === 'modelos') return <Modelos ocupado={p.ocupado} aoCriar={p.aoCriar} />;
  return <Conteudo {...p} colecao={p.colecao} />;
}

function Conteudo(p: PropsAreaColecao & { colecao: ColecaoConteudo }) {
  const nomes = NOMES_COLECAO[p.colecao];
  const itens = p.estado.fase === 'pronta' ? p.estado.itens : null;
  const entradas = useMemo(
    () => (itens === null ? [] : entradasDaColecao(aplicarFiltro(itens, p.filtro), p.colecao, p.busca)),
    [itens, p.filtro, p.colecao, p.busca],
  );
  if (itens === null) {
    return (
      <div className="estado" role="status">
        <h1>{nomes.titulo}</h1>
        <p>{p.estado.fase === 'erro' ? p.estado.mensagem : 'Carregando…'}</p>
      </div>
    );
  }
  const buscando = p.busca.trim() !== '';
  return (
    <>
      <div className="principal__cab">
        <h1>{nomes.titulo}</h1>
        <p className="dica" role="status">
          {entradas.length === 1 ? `1 ${nomes.singular}` : `${entradas.length} ${nomes.plural}`}
        </p>
      </div>
      <p className="dica">De todos os trabalhos da biblioteca. Para alterar, abra o trabalho.</p>
      {entradas.length === 0 ? (
        <div className="estado" role="status">
          <p>{buscando ? 'Nenhum resultado para a busca.' : nomes.vazio}</p>
        </div>
      ) : (
        <ul className="colecao__lista" aria-label={nomes.titulo}>
          {entradas.map((e) => (
            <li key={e.chave} className="colecao__item">
              <p className="colecao__texto">
                {p.colecao === 'siglas' ? (
                  <>
                    <strong>{e.texto}</strong> — {e.complemento}
                  </>
                ) : (
                  e.texto
                )}
              </p>
              <p className="colecao__onde">
                {e.trabalhos.length === 1 ? 'No trabalho' : 'Nos trabalhos'}{' '}
                {e.trabalhos.map((t, i) => (
                  <span key={t.id}>
                    {i > 0 && ', '}
                    <button type="button" className="btn-link" onClick={() => p.aoAbrir(t.id)} disabled={p.ocupado} aria-label={`Abrir o trabalho ${t.titulo}`}>
                      {t.titulo}
                    </button>
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Modelos({ ocupado, aoCriar }: { ocupado: boolean; aoCriar: (tipo: TipoTrabalhoUft) => void }) {
  return (
    <>
      <div className="principal__cab">
        <h1>Modelos</h1>
      </div>
      <p className="dica">Cada modelo cria um trabalho com os elementos e as seções do tipo, conforme o Manual da UFT.</p>
      <ul className="colecao__lista" aria-label="Modelos">
        {TIPOS_NOVO_TRABALHO.map((t) => (
          <li key={t.id} className="colecao__item">
            <p className="colecao__texto">
              <strong>{ROTULOS_TIPO[t.id]}</strong>
            </p>
            <p className="colecao__onde">{t.descricao}</p>
            <div>
              <button type="button" className="btn-secundario" onClick={() => aoCriar(t.id)} disabled={ocupado} aria-label={`Criar trabalho: ${ROTULOS_TIPO[t.id]}`}>
                Criar trabalho
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
