/**
 * Conferência da bibliografia (M4-T08): o que o verificador achou nas citações e nas obras, no lugar do editor. Cada
 * item leva ao ponto do texto ou ao formulário da obra. Só diagnostica: nada muda sem o usuário. Texto sempre como
 * texto (nunca HTML).
 */
import { useId } from 'react';
import type { LocalProblema, ObraNaLista, ProblemaBibliografia, ResumoSecao } from '../../aplicacao';
import { Icone } from '../Icones';

export interface PropsConferencia {
  problemas: readonly ProblemaBibliografia[];
  obras: readonly ObraNaLista[];
  secoes: readonly ResumoSecao[];
  aoIrAoTexto: (local: Extract<LocalProblema, { tipo: 'texto' }>) => void;
  aoAbrirObra: (id: string) => void;
  aoFechar: () => void;
}

const ROTULO_CODIGO: Record<ProblemaBibliografia['codigo'], string> = {
  REFERENCIAS_AUSENTES: 'Falta a lista de referências',
  CHAMADA_SEM_LIGACAO: 'Chamada escrita como texto',
  OBRA_NAO_CITADA: 'Obra não citada',
  CHAMADA_AMBIGUA: 'Chamadas iguais para obras diferentes',
  GRAFIA_DIVERGENTE: 'Mesmo autor com grafias diferentes',
  PRENOMES_NAO_UNIFORMES: 'Prenomes não uniformes',
  CHAMADA_COM_AVISO: 'Chamada com aviso',
  REFERENCIA_INCOMPLETA: 'Referência incompleta',
};

function resumo(problemas: readonly ProblemaBibliografia[]): string {
  if (problemas.length === 0) return 'Nada a conferir: toda chamada está ligada a uma obra e toda obra é citada.';
  const erros = problemas.filter((p) => p.gravidade === 'erro').length;
  const avisos = problemas.length - erros;
  const partes = [erros > 0 ? `${erros} ${erros === 1 ? 'erro' : 'erros'}` : '', avisos > 0 ? `${avisos} ${avisos === 1 ? 'aviso' : 'avisos'}` : ''].filter((x) => x !== '');
  return `${partes.join(' e ')} na bibliografia.`;
}

export function ConferenciaBibliografia(p: PropsConferencia) {
  const base = useId();
  const onde = (l: LocalProblema): string => {
    if (l.tipo === 'trabalho') return 'Trabalho';
    if (l.tipo === 'obra') return p.obras.find((o) => o.obra.id === l.obra)?.referencia ?? 'Obra';
    const s = p.secoes.find((x) => x.id === l.secao);
    return s ? `Seção ${s.indicativo} ${s.titulo}`.trim() : 'Texto';
  };
  return (
    // A região com o nome "Conferência da bibliografia" é a da área do editor (AreaEscrever): aqui, só o conteúdo.
    <div className="conferencia">
      <div className="elemento__cab">
        <h2 id={`${base}-titulo`}>Conferência da bibliografia</h2>
        <button type="button" className="btn-secundario" onClick={p.aoFechar}>
          Fechar
        </button>
      </div>
      <p role="status">{resumo(p.problemas)}</p>
      {p.problemas.length > 0 && (
        <ul className="conferencia__lista" aria-label="Problemas da bibliografia">
          {p.problemas.map((x, i) => (
            <li key={i} className={x.gravidade === 'erro' ? 'aviso aviso--erro' : 'aviso'}>
              <Icone nome={x.gravidade === 'erro' ? 'erro' : 'alerta'} />
              <div className="conferencia__item">
                <strong>{ROTULO_CODIGO[x.codigo]}</strong>
                <span className="conferencia__onde">{onde(x.local)}</span>
                <span>
                  {x.mensagem} <span className="dica">({x.origem.join(', ')})</span>
                </span>
                {x.local.tipo === 'texto' && (
                  <button type="button" className="btn-secundario" onClick={() => p.aoIrAoTexto(x.local as Extract<LocalProblema, { tipo: 'texto' }>)}>
                    Ir ao texto
                  </button>
                )}
                {x.local.tipo === 'obra' && (
                  <button type="button" className="btn-secundario" onClick={() => p.aoAbrirObra((x.local as Extract<LocalProblema, { tipo: 'obra' }>).obra)}>
                    Abrir obra
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
