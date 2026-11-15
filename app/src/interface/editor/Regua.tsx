/**
 * Régua da página (Etapa 2 da especificação de atualização, D-E2-06), alinhada à folha e com o zoom: marcas de
 * centímetro contadas a partir da margem esquerda (como no Word), as margens do perfil sombreadas e o recuo da primeira
 * linha do parágrafo marcado. Só mostra: no perfil UFT as margens e o recuo são fixos (RN-001, RN-003); mudam pelo modelo
 * de evento (Trabalho › Modelo de evento), que a régua acompanha. Decorativa para o leitor de tela, com a descrição
 * no `title`.
 */
import type { PaginaMm } from '../../aplicacao';

export function Regua({ pagina, recuoMm }: { pagina: PaginaMm; recuoMm: number }) {
  const util = pagina.larguraMm - pagina.margemEsquerdaMm - pagina.margemDireitaMm;
  const marcas: number[] = [];
  for (let mm = -Math.floor(pagina.margemEsquerdaMm / 10) * 10; mm <= util + pagina.margemDireitaMm; mm += 5) marcas.push(mm);
  const descricao = `Margens: esquerda ${(pagina.margemEsquerdaMm / 10).toLocaleString('pt-BR')} cm, direita ${(pagina.margemDireitaMm / 10).toLocaleString('pt-BR')} cm; largura do texto ${(util / 10).toLocaleString('pt-BR')} cm; recuo da primeira linha ${(recuoMm / 10).toLocaleString('pt-BR')} cm (do perfil).`;
  return (
    <div className="regua" aria-hidden="true" title={descricao} data-testid="regua">
      <div className="regua__margem" style={{ left: 0, width: `calc(${pagina.margemEsquerdaMm} * var(--mm))` }} />
      <div className="regua__margem" style={{ right: 0, width: `calc(${pagina.margemDireitaMm} * var(--mm))` }} />
      {marcas.map((mm) => (
        <span key={mm} className={mm % 10 === 0 ? 'regua__marca regua__marca--cm' : 'regua__marca'} style={{ left: `calc(${pagina.margemEsquerdaMm + mm} * var(--mm))` }}>
          {mm % 10 === 0 && mm !== 0 ? <span className="regua__numero">{Math.abs(mm / 10)}</span> : null}
        </span>
      ))}
      <span className="regua__recuo" style={{ left: `calc(${pagina.margemEsquerdaMm + recuoMm} * var(--mm))` }} />
    </div>
  );
}
