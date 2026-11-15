// Etapa 3 da especificação de atualização — preenchimento opcional da ficha institucional com IA. A resposta da IA vira
// uma ficha que passa pelo esquema e pela mesma prévia da importação; perfil sugerido chega sem revisão; o trecho de
// origem e o que ficou incerto aparecem; vínculo com nome desconhecido vira pendência.
import { describe, expect, it } from 'vitest';
import { importarFicha, lerSugestaoFicha, pedidoPreencherFicha, textoDoArquivoFicha, type Catalogo } from '../src/aplicacao';

const VAZIO: Catalogo = { formato: 'bibliodocs-catalogo', versao: 1, instituicoes: [] };
const URL = 'https://www.exemplo.edu.br/manual';

const RESPOSTA = `Segue a ficha:
\`\`\`json
{
  "instituicao": {"nome": "Universidade Federal de Teste", "sigla": "UFTE"},
  "campi": [{"nome": "Campus Sul", "especie": "câmpus", "cidade": "Gurupi", "uf": "to", "trecho": "Câmpus de Gurupi"}],
  "cursos": [
    {"nome": "Agronomia", "nivel": "graduação", "grau": "Bacharelado", "campi": ["campus sul"], "trecho": "Agronomia (bacharelado)"},
    {"nome": "Zootecnia", "nivel": "graduacao", "campi": ["Campus Leste"], "incerto": true}
  ],
  "disciplinas": [],
  "docentes": [{"nome": "Ana Souza", "titulacao": "Dra.", "cursos": ["Agronomia"], "trecho": "Profa. Dra. Ana Souza"}],
  "manuais": [{"titulo": "Manual de Normalização", "edicao": "2. ed.", "data": "2024", "trecho": "Manual de Normalização, 2. ed."}],
  "perfis": [{"nome": "TCC da UFTE", "manual": "manual de normalizacao", "secao": "Seção 3", "regras": {"margemSuperiorCm": 3, "corpoPt": 500, "fonte": "Arial", "inventada": 1}, "instrucoes": ["Até 60 páginas."], "tipos": ["monografia", "romance"], "trecho": "margens de 3 cm"}],
  "observacoes": ["O texto não informa a entrelinha."]
}
\`\`\``;

describe('Ficha institucional com IA', () => {
  it('o pedido leva o texto, a origem e a instituição escolhida; o texto é cortado no limite', () => {
    const p = pedidoPreencherFicha({ texto: 'x'.repeat(70_000), url: URL, instituicao: { nome: 'Universidade Federal de Teste', sigla: 'UFTE' } });
    expect(p.mensagens[0]!.papel).toBe('sistema');
    const u = p.mensagens[1]!.texto;
    expect(u).toContain('Instituição: Universidade Federal de Teste (UFTE)');
    expect(u).toContain(`Origem do texto: ${URL}`);
    expect(u.length).toBeLessThan(60_200);
  });

  it('a resposta vira uma ficha válida, com fonte, trecho e vínculos pelo nome', () => {
    const r = lerSugestaoFicha(RESPOSTA, { url: URL }, '2026-11-15');
    if (!r.ok) throw new Error(r.mensagem);
    const f = r.ficha;
    expect(f.instituicao).toEqual({ nome: 'Universidade Federal de Teste', sigla: 'UFTE' });
    expect(f.campi[0]).toMatchObject({ nome: 'Campus Sul', especie: 'campus', cidade: 'Gurupi', uf: 'TO', fonte: { url: URL, consultadoEm: '2026-11-15', observacao: 'Trecho: “Câmpus de Gurupi”' } });
    expect(f.cursos[0]).toMatchObject({ nome: 'Agronomia', nivel: 'graduacao', grau: 'bacharelado', campi: [f.campi[0]!.chave] });
    expect(f.docentes[0]!.cursos).toEqual([f.cursos[0]!.chave]);
    // Regras: só aspectos conhecidos e valores dentro dos limites; tipos desconhecidos saem.
    expect(f.perfis[0]).toMatchObject({ regras: { margemSuperiorCm: 3, fonte: 'Arial' }, manual: f.manuais[0]!.chave, tipos: ['monografia'], instrucoes: ['Até 60 páginas.'] });
    expect(f.perfis[0]!.regras).not.toHaveProperty('corpoPt');
    expect(r.origens.find((o) => o.rotulo === 'Curso ou programa: Zootecnia')).toEqual({ rotulo: 'Curso ou programa: Zootecnia', incerto: true });
    expect(r.observacoes).toEqual(['O texto não informa a entrelinha.']);
  });

  it('a sugestão passa pela prévia: câmpus desconhecido vira pendência e o perfil chega sem revisão', () => {
    const r = lerSugestaoFicha(RESPOSTA, { url: URL }, '2026-11-15');
    if (!r.ok) throw new Error(r.mensagem);
    const imp = importarFicha(VAZIO, r.ficha);
    expect(imp.previa.pendencias.some((p) => p.tipo === 'incompleta' && /Zootecnia/.test(p.mensagem))).toBe(true);
    const inst = imp.catalogo.instituicoes[0]!;
    expect(inst.perfisInstitucionais![0]!.revisado).toBe(false);
    expect(inst.campi[0]!.cursos.map((c) => c.nome)).toEqual(['Agronomia']);
  });

  it('com a instituição escolhida, a sugestão fica presa a ela; sem instituição identificada, recusa', () => {
    const presa = lerSugestaoFicha('{"instituicao": {"nome": "Outra", "sigla": "OUT"}, "campi": []}', { instituicao: { nome: 'Universidade Federal do Tocantins', sigla: 'UFT' } }, '2026-11-15');
    expect(presa.ok && presa.ficha.instituicao.sigla).toBe('UFT');
    expect(lerSugestaoFicha('{"campi": []}', {}, '2026-11-15').ok).toBe(false);
    expect(lerSugestaoFicha('não sei', {}, '2026-11-15').ok).toBe(false);
  });

  it('sem endereço https, os registros ficam sem fonte (aparecem como sem fonte confirmada)', () => {
    const r = lerSugestaoFicha(RESPOSTA, { url: 'http://inseguro.br' }, '2026-11-15');
    expect(r.ok && r.ficha.campi[0]!.fonte).toBe(undefined);
  });

  it('HTML salvo da página vira texto, sem scripts', () => {
    expect(textoDoArquivoFicha('p.html', '<html><script>alert(1)</script><p>Câmpus&nbsp;de Palmas</p><li>Direito</li></html>')).toBe('Câmpus de Palmas\nDireito');
    expect(textoDoArquivoFicha('p.txt', '<b>x</b>')).toBe('<b>x</b>');
  });
});
