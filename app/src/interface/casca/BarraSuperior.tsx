// Faixa 1: navegação entre seções + pré-visualizar + zoom (decisão do usuário), visor central com o pequi,
// alternar grade/lista e busca (Ctrl+F). Seções e zoom ficam desativados mesmo com trabalho aberto: o M1 só edita o
// título; a navegação entre seções chega com o editor (M2) e a pré-visualização e o zoom, com a página (M3).
import type { Ref } from 'react';
import { Icone, Pequi } from '../Icones';
import { linhasDoVisor, type EstadoVisor } from './visor';

export interface PropsBarraSuperior {
  visor: EstadoVisor;
  modoLista: boolean;
  aoAlternarModo: () => void;
  busca: string;
  aoBuscar: (termo: string) => void;
  refBusca: Ref<HTMLInputElement>;
}

export function BarraSuperior({ visor, modoLista, aoAlternarModo, busca, aoBuscar, refBusca }: PropsBarraSuperior) {
  // Sem seções nem página para mostrar no M1 (ver o comentário do topo).
  const semDocumento = true;
  return (
    <header className="barra">
      <div className="barra__esq">
        <button className="btn-icone btn-icone--grande" type="button" aria-label="Seção anterior" title="Seção anterior (Ctrl+Page Up)" disabled={semDocumento}>
          <Icone nome="anterior" />
        </button>
        <button className="btn-icone btn-icone--grande" type="button" aria-label="Pré-visualizar trabalho" title="Pré-visualizar (Ctrl+P)" disabled={semDocumento}>
          <Icone nome="preview" />
        </button>
        <button className="btn-icone btn-icone--grande" type="button" aria-label="Próxima seção" title="Próxima seção (Ctrl+Page Down)" disabled={semDocumento}>
          <Icone nome="proxima" />
        </button>
        <label className="zoom">
          <span>Zoom</span>
          <input type="range" min={50} max={200} step={10} defaultValue={100} aria-label="Zoom da página" aria-valuetext="100%" disabled={semDocumento} />
        </label>
      </div>

      <Visor estado={visor} />

      <div className="barra__dir">
        <button
          className="btn-icone"
          type="button"
          aria-pressed={modoLista}
          aria-label="Mostrar como lista"
          title={modoLista ? 'Mostrar como grade' : 'Mostrar como lista'}
          onClick={aoAlternarModo}
        >
          <Icone nome={modoLista ? 'grade' : 'lista'} />
        </button>
        <div className="busca" role="search">
          <Icone nome="busca" />
          <input
            ref={refBusca}
            type="search"
            placeholder="Buscar"
            aria-label="Buscar trabalhos pelo título ou nome do arquivo"
            aria-keyshortcuts="Control+F"
            value={busca}
            onChange={(e) => aoBuscar(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && busca !== '') {
                e.preventDefault();
                aoBuscar('');
              }
            }}
          />
          <span className="atalho" aria-hidden="true">
            Ctrl+F
          </span>
        </div>
      </div>
    </header>
  );
}

/**
 * Só a linha do estado (salvamento ou exportação) é região viva: o título muda a cada tecla digitada e não deve ser
 * relido pelo leitor de tela (revisão do M1-T11; WCAG 4.1.3).
 */
export function Visor({ estado }: { estado: EstadoVisor }) {
  if (estado.tipo === 'vazio') {
    return (
      <div className="visor">
        <Pequi className="visor__pequi" rotulo="BiblioDocs Pro — nenhum trabalho aberto" />
      </div>
    );
  }
  const t = estado.trabalho;
  return (
    <div className="visor">
      <div className="visor__trabalho">
        <div className="visor__titulo" title={t.titulo}>
          {t.titulo}
        </div>
        <div className="visor__linha">
          {linhasDoVisor(t).map((l, i) => (
            // A 2.ª linha é sempre o salvamento ou a exportação (linhasDoVisor); chave pela posição, para a região
            // viva continuar a mesma quando o texto muda.
            <span key={i} className={l.erro ? 'visor__erro' : undefined} role={i === 1 ? 'status' : undefined} title={l.texto}>
              {l.texto}
            </span>
          ))}
        </div>
        {t.exportacao !== null && (
          <progress className="visor__progresso" max={1} value={t.exportacao} aria-label="Progresso da exportação" />
        )}
      </div>
    </div>
  );
}
