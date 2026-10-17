// Faixa 1: navegação entre seções + pré-visualizar + zoom (decisão do usuário), visor central com o pequi,
// alternar grade/lista e busca (Ctrl+F). Os controles do trabalho aberto ficam desativados até haver editor.
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
  const semTrabalho = visor.tipo === 'vazio';
  return (
    <header className="barra">
      <div className="barra__esq">
        <button className="btn-icone btn-icone--grande" type="button" aria-label="Seção anterior" title="Seção anterior (Ctrl+Page Up)" disabled={semTrabalho}>
          <Icone nome="anterior" />
        </button>
        <button className="btn-icone btn-icone--grande" type="button" aria-label="Pré-visualizar trabalho" title="Pré-visualizar (Ctrl+P)" disabled={semTrabalho}>
          <Icone nome="preview" />
        </button>
        <button className="btn-icone btn-icone--grande" type="button" aria-label="Próxima seção" title="Próxima seção (Ctrl+Page Down)" disabled={semTrabalho}>
          <Icone nome="proxima" />
        </button>
        <label className="zoom">
          <span>Zoom</span>
          <input type="range" min={50} max={200} step={10} defaultValue={100} aria-label="Zoom da página" aria-valuetext="100%" disabled={semTrabalho} />
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

export function Visor({ estado }: { estado: EstadoVisor }) {
  if (estado.tipo === 'vazio') {
    return (
      <div className="visor" role="status">
        <Pequi className="visor__pequi" rotulo="BiblioDocs Pro — nenhum trabalho aberto" />
      </div>
    );
  }
  const t = estado.trabalho;
  return (
    <div className="visor" role="status">
      <div className="visor__trabalho">
        <div className="visor__titulo" title={t.titulo}>
          {t.titulo}
        </div>
        <div className="visor__linha">
          {linhasDoVisor(t).map((l) => (
            <span key={l.texto} className={l.erro ? 'visor__erro' : undefined}>
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
