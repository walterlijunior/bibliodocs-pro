// Conteúdo da aba Biblioteca: cabeçalho, avisos da pasta e os estados carregando, erro, vazio, sem resultado e cheio.
// M1-T12: as ofertas de recuperação aparecem no topo dos avisos, com Recuperar, Abrir o arquivo salvo e Decidir depois.
import type { IdentificadorItem, IdentificadorOferta, ItemBiblioteca, OfertaRecuperacao } from '../../aplicacao';
import { Icone, Pequi } from '../Icones';
import { GradeTrabalhos } from './GradeTrabalhos';
import { rotuloRecuperar, textoOferta } from './recuperacao';
import type { EstadoBiblioteca, MensagemAcao } from './useBiblioteca';

export const AVISO_NUVEM =
  'Esta pasta é sincronizada pelo OneDrive. A sincronização pode atrasar a gravação ou criar cópias em conflito; ' +
  'se possível, escolha uma pasta fora do OneDrive (Arquivo › Escolher pasta da biblioteca…).';

const QUANTIDADE_ESQUELETOS = 8;

export interface PropsAreaBiblioteca {
  estado: EstadoBiblioteca;
  titulo: string;
  /** Itens já filtrados e buscados. */
  itens: readonly ItemBiblioteca[];
  buscando: boolean;
  modoLista: boolean;
  selecionado: IdentificadorItem | null;
  focarId: { id: IdentificadorItem } | null;
  mensagem: MensagemAcao | null;
  ocupado: boolean;
  aoSelecionar: (id: IdentificadorItem) => void;
  aoAbrir?: (id: IdentificadorItem) => void;
  aoCriar: () => void;
  aoTentarDeNovo: () => void;
  aoEscolherPasta: () => void;
  /** Ofertas de recuperação (M1-T12). */
  ofertas?: readonly OfertaRecuperacao[];
  /** Data de hoje, para escrever "15:42" ou "14/10/2026 às 15:42". */
  hoje?: Date;
  aoRecuperar?: (id: IdentificadorOferta) => void;
  aoAbrirSalvo?: (id: IdentificadorOferta) => void;
  aoAdiar?: (id: IdentificadorOferta) => void;
}

export function AreaBiblioteca(p: PropsAreaBiblioteca) {
  if (p.estado.fase === 'carregando') {
    return (
      <>
        <p className="sr-only" role="status">
          Carregando trabalhos…
        </p>
        <ul className="grade" aria-hidden="true">
          {Array.from({ length: QUANTIDADE_ESQUELETOS }, (_, i) => (
            <li key={i}>
              <div className="esqueleto" />
            </li>
          ))}
        </ul>
      </>
    );
  }

  if (p.estado.fase === 'erro') {
    return (
      <div className="estado estado--erro" role="alert">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <use href="#i-erro" />
        </svg>
        <h2>Não foi possível abrir a biblioteca</h2>
        <p>{p.estado.mensagem}</p>
        <p>Seus arquivos não foram alterados.</p>
        <div className="acoes">
          <button type="button" className="btn-principal" onClick={p.aoTentarDeNovo}>
            Tentar de novo
          </button>
          <button type="button" className="btn-secundario" onClick={p.aoEscolherPasta}>
            Escolher outra pasta…
          </button>
        </div>
      </div>
    );
  }

  const { pasta, itens: todos, avisos } = p.estado;
  const ofertas = p.ofertas ?? [];
  const hoje = p.hoje ?? new Date();
  return (
    <>
      <div className="principal__cab">
        <h1>{p.titulo}</h1>
        {todos.length > 0 && (
          <button type="button" className="btn-principal" onClick={p.aoCriar} disabled={p.ocupado}>
            Novo trabalho
          </button>
        )}
      </div>

      <ul className="avisos" aria-label="Avisos" hidden={ofertas.length === 0 && !pasta.naNuvem && avisos.length === 0 && p.mensagem === null}>
        {ofertas.map((o) => (
          <li key={o.identificador} className="aviso">
            <Icone nome="alerta" />
            <span className="aviso__texto" role="status">
              {textoOferta(o, hoje)}
            </span>
            <span className="aviso__acoes">
              <button type="button" className="btn-secundario" onClick={() => p.aoRecuperar?.(o.identificador)} disabled={p.ocupado}>
                {rotuloRecuperar(o.tipo)}
              </button>
              {o.tipo === 'instantaneo' && o.arquivoSalvoExiste && (
                <button type="button" className="btn-secundario" onClick={() => p.aoAbrirSalvo?.(o.identificador)} disabled={p.ocupado}>
                  Abrir o arquivo salvo
                </button>
              )}
              <button type="button" className="btn-secundario" onClick={() => p.aoAdiar?.(o.identificador)}>
                Decidir depois
              </button>
            </span>
          </li>
        ))}
        {pasta.naNuvem && <Aviso texto={AVISO_NUVEM} />}
        {avisos.map((a) => (
          <Aviso key={a} texto={a} />
        ))}
        {p.mensagem !== null && <Aviso texto={p.mensagem.texto} erro={p.mensagem.tipo === 'erro'} info={p.mensagem.tipo === 'info'} />}
      </ul>

      {todos.length === 0 ? (
        <div className="estado">
          <Pequi />
          <h2>Nenhum trabalho por aqui</h2>
          <p>Comece um trabalho novo; o BiblioDocs Pro aplica a formatação do Manual da UFT.</p>
          <button type="button" className="btn-principal" onClick={p.aoCriar} disabled={p.ocupado}>
            Criar primeiro trabalho
          </button>
        </div>
      ) : p.itens.length === 0 ? (
        <div className="estado" role="status">
          <h2>{p.buscando ? 'Nenhum resultado para a busca' : 'Nenhum trabalho nesta seleção'}</h2>
          <p>{p.buscando ? 'Confira a grafia ou busque por outra palavra do título.' : 'Escolha outro grupo na barra lateral.'}</p>
        </div>
      ) : (
        <GradeTrabalhos
          itens={p.itens}
          modoLista={p.modoLista}
          selecionado={p.selecionado}
          aoSelecionar={p.aoSelecionar}
          aoAbrir={p.aoAbrir}
          focarId={p.focarId}
        />
      )}
    </>
  );
}

function Aviso({ texto, erro = false, info = false }: { texto: string; erro?: boolean; info?: boolean }) {
  return (
    // O papel vivo fica no texto, não no <li> (que perderia o papel de item de lista; revisão do M1-T11).
    <li className={erro ? 'aviso aviso--erro' : info ? 'aviso aviso--info' : 'aviso'}>
      <Icone nome={erro ? 'erro' : info ? 'ok' : 'alerta'} />
      <span role={erro ? 'alert' : info ? 'status' : undefined}>{texto}</span>
    </li>
  );
}
