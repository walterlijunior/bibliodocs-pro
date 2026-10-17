// Faixa 3: Voltar/Avançar, seletor de coleção e abas (padrão ARIA de abas com ativação automática).
import { useRef } from 'react';
import { Icone } from '../Icones';
import { ABAS, COLECOES, type IdAba, type IdColecao } from './definicoes';
import { proximaAba, temModificador } from './teclado';

export interface PropsNavegacao {
  podeVoltar: boolean;
  podeAvancar: boolean;
  aoVoltar: () => void;
  aoAvancar: () => void;
  colecao: IdColecao;
  aoEscolherColecao: (c: IdColecao) => void;
  aba: IdAba;
  aoEscolherAba: (a: IdAba) => void;
}

/** Id do elemento da aba, usado pelo painel em `aria-labelledby`. */
export const idDaAba = (a: IdAba): string => `aba-${a}`;
export const ID_PAINEL = 'painel-principal';

export function Navegacao(p: PropsNavegacao) {
  const abas = useRef<(HTMLButtonElement | null)[]>([]);
  const atual = ABAS.findIndex((a) => a.id === p.aba);
  return (
    <nav className="nav" aria-label="Navegação">
      <div className="nav__esq">
        <span className="par-setas">
          <button className="btn-icone" type="button" aria-label="Voltar" title="Voltar (Alt+Seta para a esquerda)" disabled={!p.podeVoltar} onClick={p.aoVoltar}>
            <Icone nome="esq" />
          </button>
          <button className="btn-icone" type="button" aria-label="Avançar" title="Avançar (Alt+Seta para a direita)" disabled={!p.podeAvancar} onClick={p.aoAvancar}>
            <Icone nome="dir" />
          </button>
        </span>
        <select
          className="colecao"
          aria-label="Coleção"
          value={p.colecao}
          onChange={(e) => p.aoEscolherColecao(e.target.value as IdColecao)}
        >
          {COLECOES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.rotulo}
            </option>
          ))}
        </select>
      </div>
      <div className="abas" role="tablist" aria-label="Áreas">
        {ABAS.map((a, i) => (
          <button
            key={a.id}
            ref={(b) => {
              abas.current[i] = b;
            }}
            id={idDaAba(a.id)}
            className="aba"
            type="button"
            role="tab"
            aria-selected={a.id === p.aba}
            aria-controls={ID_PAINEL}
            tabIndex={a.id === p.aba ? 0 : -1}
            onClick={() => p.aoEscolherAba(a.id)}
            onKeyDown={(e) => {
              if (temModificador(e)) return;
              const j = proximaAba(e.key, atual, ABAS.length);
              const destino = j === null ? undefined : ABAS[j];
              if (j === null || destino === undefined) return;
              e.preventDefault();
              p.aoEscolherAba(destino.id);
              abas.current[j]?.focus();
            }}
          >
            {a.rotulo}
          </button>
        ))}
      </div>
      <div />
    </nav>
  );
}
