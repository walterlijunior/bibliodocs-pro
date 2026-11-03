/**
 * Textos da recuperação (M1-T12; ADR-0004, seção 4): a oferta mostrada na Biblioteca ao iniciar e o aviso que
 * acompanha o trabalho recuperado. Puro, testado em Node (tests/interface-logica.test.ts).
 */
import type { AvisoSessao, OfertaRecuperacao, TipoOferta } from '../../aplicacao';

const dois = (n: number) => String(n).padStart(2, '0');

/** "15:42" no mesmo dia; "14/10/2026 às 15:42" em outro dia (hora local). */
export function quandoLegivel(ms: number, hoje: Date): string {
  const d = new Date(ms);
  const hora = `${dois(d.getHours())}:${dois(d.getMinutes())}`;
  const mesmoDia = d.getFullYear() === hoje.getFullYear() && d.getMonth() === hoje.getMonth() && d.getDate() === hoje.getDate();
  return mesmoDia ? hora : `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} às ${hora}`;
}

const nomeDoTrabalho = (o: Pick<OfertaRecuperacao, 'titulo' | 'nomeArquivo'>) =>
  o.titulo.trim() !== '' ? `“${o.titulo}” (${o.nomeArquivo})` : `“${o.nomeArquivo}”`;

export function textoOferta(o: OfertaRecuperacao, hoje: Date): string {
  const quando = quandoLegivel(o.quando, hoje);
  switch (o.tipo) {
    case 'instantaneo':
      return (
        `O BiblioDocs Pro foi fechado inesperadamente com ${nomeDoTrabalho(o)} aberto. Recuperar a versão de ${quando}?` +
        (o.arquivoSalvoExiste ? '' : ' O arquivo salvo não foi encontrado.')
      );
    case 'temporario':
      return (
        `“${o.nomeArquivo}” ${o.arquivoSalvoExiste ? 'não pôde ser lido' : 'não foi encontrado'}, mas há uma cópia completa de ` +
        `${quando}, de uma gravação interrompida. Restaurar essa cópia?`
      );
    case 'bak':
      return `“${o.nomeArquivo}” não pôde ser lido, mas a cópia de segurança (.bak) de ${quando} está íntegra. Restaurar a cópia de segurança?`;
  }
}

/** Rótulo do botão que aceita a oferta. */
export const rotuloRecuperar = (tipo: TipoOferta) => (tipo === 'instantaneo' ? 'Recuperar' : 'Restaurar');

/** Aviso da versão aberta pelo diálogo "Versões descartadas": ela não está em nenhum arquivo (R-M2-04, R-M2-10). */
export function textoDescartada(quando: number, hoje: Date): string {
  return (
    `Versão descartada, guardada em ${quandoLegivel(quando, hoje)}. Nenhum arquivo foi alterado. ` +
    'O que você escrever aqui não tem cópia de recuperação até usar “Salvar como…”.'
  );
}

/** Aviso do trabalho aberto a partir de uma oferta. */
export function avisoRecuperado(tipo: TipoOferta, quando: number, hoje: Date): AvisoSessao {
  const q = quandoLegivel(quando, hoje);
  if (tipo === 'instantaneo') {
    return {
      nivel: 'info',
      texto: `Versão recuperada de ${q}. Ela ainda não está no arquivo: é salva sozinha em 30 segundos, ou agora com Ctrl+S.`,
      acoes: [],
    };
  }
  const origem = tipo === 'bak' ? 'da cópia de segurança (.bak)' : 'da cópia da gravação interrompida';
  return { nivel: 'info', texto: `O arquivo foi restaurado a partir ${origem} de ${q}.`, acoes: [] };
}

/** Aviso da cópia aberta pelo diálogo "Cópias de segurança" (M3-T09). */
export function textoBackup(quando: number, hoje: Date): string {
  return (
    `Cópia de segurança de ${quandoLegivel(quando, hoje)}. Nenhum arquivo foi alterado. ` +
    'O que você escrever aqui não tem cópia de recuperação até usar “Salvar como…”.'
  );
}
