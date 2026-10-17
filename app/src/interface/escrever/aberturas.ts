/**
 * Textos da abertura de um trabalho (M1-T11): avisos que acompanham o trabalho aberto e mensagens de quando ele não
 * abre. Puro, testado em Node (tests/interface-logica.test.ts).
 */
import type { AvisoSessao, ProjetoAberto } from '../../aplicacao';

/** Avisos da leitura (ex.: mídia descartada) e da atualização de formato antigo. */
export function avisosDaAbertura(projeto: Pick<ProjetoAberto, 'avisos' | 'atualizacao'>): AvisoSessao[] {
  const avisos: AvisoSessao[] = projeto.avisos.map((a) => ({ nivel: 'alerta', texto: a.mensagem, acoes: [] }));
  if (projeto.atualizacao !== null) {
    avisos.push({
      nivel: 'info',
      texto:
        'Este trabalho foi atualizado para o formato desta versão do BiblioDocs Pro. ' +
        `Uma cópia do arquivo original ficou na pasta de backups do aplicativo: ${projeto.atualizacao.nomeBackup}.`,
      acoes: [],
    });
  }
  return avisos;
}

/** Aviso do trabalho de versão futura aberto só para leitura. */
export function avisoSomenteLeitura(nomeArquivo: string): AvisoSessao {
  return {
    nivel: 'alerta',
    texto: `“${nomeArquivo}” foi gravado por uma versão mais nova do BiblioDocs Pro e abriu só para leitura. Atualize o aplicativo para editá-lo.`,
    acoes: [],
  };
}

/** Versão futura que esta versão nem consegue mostrar. */
export function mensagemVersaoFutura(nomeArquivo: string, versaoFormato: number): string {
  return (
    `“${nomeArquivo}” foi gravado por uma versão mais nova do BiblioDocs Pro (formato ${versaoFormato}) e não pode ser aberto ` +
    'por esta versão. Atualize o aplicativo. O arquivo não foi alterado.'
  );
}
