// Faixa 1: navegação entre seções + zoom do texto, visor central com o pequi, alternar grade/lista e busca (Ctrl+F).
// M2-T07: "Seção anterior" e "Próxima seção" ligados (Ctrl+Page Up/Down), ativos quando há seção para onde ir.
// Etapa 2 da especificação de atualização: os símbolos de reprodução (⏪ e ⏩, que lembravam um player de vídeo) viraram
// setas de seção com o nome escrito; o botão "Pré-visualizar", que nunca teve função, saiu; o zoom passou a ampliar o
// texto do editor (50% a 200%), ativo com um trabalho aberto na aba Escrever.
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
  /** Há seção antes (ou depois) da ativa no trabalho aberto. */
  podeAnterior: boolean;
  podeProxima: boolean;
  aoSecaoAnterior: () => void;
  aoProximaSecao: () => void;
  /** Zoom do texto do editor, em %. */
  zoom: number;
  podeZoom: boolean;
  aoZoom: (zoom: number) => void;
}

export function BarraSuperior(p: PropsBarraSuperior) {
  const { visor, modoLista, aoAlternarModo, busca, aoBuscar, refBusca } = p;
  // Sem seção nenhuma para onde ir (sem trabalho, ou uma seção só): desativados. Na ponta da lista, só `aria-disabled`:
  // desativar o botão que acabou de levar à última seção tiraria o foco dele (revisão do M2-T07, B5).
  const semSecoes = !p.podeAnterior && !p.podeProxima;
  return (
    <header className="barra">
      <div className="barra__esq">
        <button className="btn-nav-secao" type="button" title="Seção anterior (Ctrl+Page Up)" aria-keyshortcuts="Control+PageUp" disabled={semSecoes} aria-disabled={!p.podeAnterior || undefined} onClick={() => p.podeAnterior && p.aoSecaoAnterior()}>
          <Icone nome="secaoAnterior" />
          <span className="btn-nav-secao__texto">Seção anterior</span>
        </button>
        <button className="btn-nav-secao" type="button" title="Próxima seção (Ctrl+Page Down)" aria-keyshortcuts="Control+PageDown" disabled={semSecoes} aria-disabled={!p.podeProxima || undefined} onClick={() => p.podeProxima && p.aoProximaSecao()}>
          <Icone nome="secaoSeguinte" />
          <span className="btn-nav-secao__texto">Próxima seção</span>
        </button>
        <label className="zoom" title="Tamanho do texto no editor (não muda o arquivo exportado)">
          <span>Zoom</span>
          <input
            type="range"
            min={50}
            max={200}
            step={10}
            value={p.zoom}
            aria-label="Zoom do texto"
            aria-valuetext={`${p.zoom}%`}
            disabled={!p.podeZoom}
            onChange={(e) => p.aoZoom(Number(e.target.value))}
          />
          <span className="zoom__valor" aria-hidden="true">{p.zoom}%</span>
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
