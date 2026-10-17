/**
 * Conteúdo do visor central (decisão do usuário, 2026-10-16): sem trabalho aberto, só o pequi; com trabalho aberto,
 * título, tipo, estado de salvamento, número de não conformidades e progresso da exportação. Puro, testado em Node.
 * No M1-T10 nada abre trabalho, então o visor mostra o pequi; o M1-T11 liga o estado de salvamento.
 */

export type EstadoSalvamento =
  | { tipo: 'salvo'; em: Date }
  | { tipo: 'salvando' }
  | { tipo: 'naoSalvo' }
  | { tipo: 'erro'; mensagem: string };

export interface TrabalhoNoVisor {
  titulo: string;
  tipo: string;
  salvamento: EstadoSalvamento;
  /** `null` enquanto o verificador não existe (M4) ou ainda não rodou. */
  naoConformidades: number | null;
  /** Fração de 0 a 1 enquanto exporta; `null` fora da exportação. */
  exportacao: number | null;
}

export type EstadoVisor = { tipo: 'vazio' } | { tipo: 'trabalho'; trabalho: TrabalhoNoVisor };

export interface LinhaVisor {
  texto: string;
  erro: boolean;
}

export function textoSalvamento(s: EstadoSalvamento): string {
  switch (s.tipo) {
    case 'salvo':
      return `Salvo às ${s.em.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    case 'salvando':
      return 'Salvando…';
    case 'naoSalvo':
      return 'Alterações não salvas';
    case 'erro':
      return `Erro ao salvar: ${s.mensagem}`;
  }
}

export function textoNaoConformidades(n: number): string {
  if (n === 0) return 'Sem não conformidades';
  return n === 1 ? '1 não conformidade' : `${n} não conformidades`;
}

/** Segunda linha do visor (abaixo do título), na ordem em que aparece. */
export function linhasDoVisor(t: TrabalhoNoVisor): LinhaVisor[] {
  const linhas: LinhaVisor[] = [{ texto: t.tipo, erro: false }];
  if (t.exportacao !== null) {
    const pct = Math.round(Math.min(1, Math.max(0, t.exportacao)) * 100);
    linhas.push({ texto: `Exportando DOCX… ${pct}%`, erro: false });
  } else {
    linhas.push({ texto: textoSalvamento(t.salvamento), erro: t.salvamento.tipo === 'erro' });
  }
  if (t.naoConformidades !== null) linhas.push({ texto: textoNaoConformidades(t.naoConformidades), erro: false });
  return linhas;
}
