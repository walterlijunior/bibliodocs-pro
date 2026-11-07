// M1-T10 — renderização da casca em Node (react-dom/server, sem DOM): as quatro faixas e seus papéis ARIA, os estados
// da biblioteca e texto sempre escapado. Sem Node aqui (tsconfig.web): a varredura UI-02 está em interface-tokens.test.ts.
// Interação real (foco, setas, clique) fica para o E2E do M1-T13 e para o roteiro manual do relatório.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resumirSecoes, type ApiBiblioDocs, type EstadoSessao, type ItemBiblioteca } from '../../src/aplicacao';
import { Aplicativo } from '../../src/interface/Aplicativo';
import { AreaBiblioteca, AVISO_NUVEM, type PropsAreaBiblioteca } from '../../src/interface/biblioteca/AreaBiblioteca';
import { BarraLateral } from '../../src/interface/biblioteca/BarraLateral';
import { PainelDetalhes } from '../../src/interface/biblioteca/PainelDetalhes';
import { contar } from '../../src/interface/biblioteca/selecao';
import { Visor } from '../../src/interface/casca/BarraSuperior';
import { MemoriaEditores } from '../../src/interface/editor/EditorSecao';
import { AreaEscrever, type PropsAreaEscrever } from '../../src/interface/escrever/AreaEscrever';
import { ArvoreSecoes, type PropsArvoreSecoes } from '../../src/interface/escrever/ArvoreSecoes';

const naoUsar = (): never => {
  throw new Error('a renderização estática não deve chamar a API');
};
const api = {
  projetos: new Proxy({}, { get: naoUsar }),
  biblioteca: new Proxy({}, { get: naoUsar }),
  recuperacao: new Proxy({}, { get: naoUsar }),
} as unknown as ApiBiblioDocs;

const contarOcorrencias = (html: string, trecho: string): number => html.split(trecho).length - 1;

function item(parcial: Partial<ItemBiblioteca> = {}): ItemBiblioteca {
  return {
    identificador: 'AAAAAAAAAAAAAAAAAAAAAA',
    nomeArquivo: 'Trabalho.bdp',
    titulo: 'Qualidade da água',
    estado: 'ok',
    tipoTrabalho: 'generico',
    criadoEm: '2026-10-16T10:00:00-03:00',
    atualizadoEm: '2026-10-16T10:00:00-03:00',
    modificadoEm: Date.UTC(2026, 9, 16, 13),
    bytes: 4096,
    ...parcial,
  };
}

const PASTA = { nome: 'Trabalhos', padrao: true, naNuvem: false };

function area(p: Partial<PropsAreaBiblioteca>): string {
  const props: PropsAreaBiblioteca = {
    estado: { fase: 'pronta', pasta: PASTA, itens: [], avisos: [] },
    titulo: 'Todos os trabalhos',
    itens: [],
    buscando: false,
    modoLista: false,
    selecionado: null,
    focarId: null,
    mensagem: null,
    ocupado: false,
    aoSelecionar: () => {},
    aoCriar: () => {},
    aoTentarDeNovo: () => {},
    aoEscolherPasta: () => {},
    ...p,
  };
  return renderToStaticMarkup(<AreaBiblioteca {...props} />);
}

describe('casca: as quatro faixas (UI-01 parcial)', () => {
  const html = renderToStaticMarkup(<Aplicativo api={api} />);

  it('barra superior com visor (pequi) e busca com Ctrl+F', () => {
    expect(html).toContain('<header class="barra">');
    expect(html).toContain('aria-label="BiblioDocs Pro — nenhum trabalho aberto"');
    expect(html).toMatch(/role="search"/);
    expect(html).toMatch(/type="search"[^>]*aria-keyshortcuts="Control\+F"/);
  });

  it('botões aprovados: seção anterior, pré-visualizar, próxima e zoom, desativados sem trabalho aberto', () => {
    for (const r of ['Seção anterior', 'Pré-visualizar trabalho', 'Próxima seção', 'Zoom da página']) {
      expect(html).toMatch(new RegExp(`aria-label="${r}"[^>]*disabled=""`));
    }
  });

  it('barra de menus com os 7 menus; só o primeiro entra no Tab', () => {
    expect(html).toContain('role="menubar"');
    expect(contarOcorrencias(html, 'aria-haspopup="menu"')).toBe(7);
    expect(contarOcorrencias(html, 'class="menu-btn" type="button" role="menuitem" aria-haspopup="menu" aria-expanded="false" tabindex="0"')).toBe(1);
  });

  it('navegação: seletor de coleção e 5 abas, Biblioteca selecionada, painel ligado à aba', () => {
    expect(html).toContain('aria-label="Coleção"');
    expect(contarOcorrencias(html, 'role="tab"')).toBe(5);
    expect(html).toMatch(/id="aba-biblioteca"[^>]*aria-selected="true"[^>]*tabindex="0"/);
    expect(html).toContain('role="tabpanel" aria-labelledby="aba-biblioteca"');
  });

  it('conteúdo: barra lateral e, antes da lista chegar, o estado "carregando"', () => {
    expect(html).toContain('<aside class="lateral" aria-label="Biblioteca">');
    expect(html).toContain('Carregando trabalhos…');
  });
});

describe('estados da biblioteca', () => {
  it('erro: mensagem do principal, tentar de novo e escolher outra pasta', () => {
    const h = area({ estado: { fase: 'erro', mensagem: 'A pasta não pôde ser lida.' } });
    expect(h).toContain('role="alert"');
    expect(h).toContain('A pasta não pôde ser lida.');
    expect(h).toContain('Tentar de novo');
    expect(h).toContain('Escolher outra pasta…');
  });

  it('vazio: pequi e "Criar primeiro trabalho"', () => {
    const h = area({});
    expect(h).toContain('Nenhum trabalho por aqui');
    expect(h).toContain('Criar primeiro trabalho');
    expect(h).not.toContain('role="listbox"');
  });

  it('sem resultado na busca', () => {
    const h = area({ estado: { fase: 'pronta', pasta: PASTA, itens: [item()], avisos: [] }, itens: [], buscando: true });
    expect(h).toContain('Nenhum resultado para a busca');
  });

  it('cheio: cartões com estado visível (versão futura, ilegível) e só um cartão no Tab', () => {
    const itens = [
      item({ identificador: 'A'.repeat(22) }),
      item({ identificador: 'B'.repeat(22), estado: 'versaoFutura', tipoTrabalho: null }),
      item({ identificador: 'C'.repeat(22), estado: 'invalido', titulo: '', nomeArquivo: 'quebrado.bdp', tipoTrabalho: null }),
    ];
    const h = area({ estado: { fase: 'pronta', pasta: PASTA, itens, avisos: [] }, itens });
    expect(h).toContain('role="listbox"');
    expect(contarOcorrencias(h, 'role="option"')).toBe(3);
    expect(contarOcorrencias(h, 'tabindex="0"')).toBe(1);
    expect(h).toContain('Criado por versão mais nova');
    expect(h).toContain('Não pôde ser lido');
    expect(h).toContain('quebrado');
    expect(h).toContain('<span class="selo">Genérico</span>');
  });

  it('pasta no OneDrive e avisos da listagem aparecem; mensagem de erro de ação é alerta', () => {
    const h = area({
      estado: { fase: 'pronta', pasta: { ...PASTA, naNuvem: true }, itens: [item()], avisos: ['Lista parcial: 2 arquivos não foram lidos.'] },
      itens: [item()],
      mensagem: { tipo: 'erro', texto: 'Disco cheio.' },
    });
    expect(h).toContain(AVISO_NUVEM.slice(0, 40));
    expect(h).toContain('Lista parcial: 2 arquivos não foram lidos.');
    expect(h).toMatch(/<li class="aviso aviso--erro">.*?<span role="alert">Disco cheio\.<\/span>/);
  });

  it('texto do arquivo vai como texto: título com marcação é escapado', () => {
    const malicioso = item({ titulo: '<img src=x onerror=alert(1)>' });
    const h = area({ estado: { fase: 'pronta', pasta: PASTA, itens: [malicioso], avisos: [] }, itens: [malicioso] });
    expect(h).not.toContain('<img');
    expect(h).toContain('&lt;img src=x onerror=alert(1)&gt;');
    const d = renderToStaticMarkup(<PainelDetalhes item={malicioso} aoFechar={() => {}} />);
    expect(d).not.toContain('<img');
  });

  it('barra lateral: "Por tipo" só com tipos presentes e item ativo marcado', () => {
    const h = renderToStaticMarkup(
      <BarraLateral contagens={contar([item(), item()])} filtro={{ tipo: 'todos' }} aoFiltrar={() => {}} nomePasta="Trabalhos" />,
    );
    expect(h).toContain('Por tipo');
    expect(h).toContain('Genérico');
    expect(h).toMatch(/aria-current="true"[^>]*>.*Todos/);
    expect(h).toContain('Pasta: Trabalhos');
    const vazio = renderToStaticMarkup(<BarraLateral contagens={contar([])} filtro={{ tipo: 'todos' }} aoFiltrar={() => {}} nomePasta={null} />);
    expect(vazio).not.toContain('Por tipo');
  });
});

describe('visor com trabalho aberto (usado a partir do M1-T11)', () => {
  it('título, tipo, salvamento, não conformidades e barra de exportação', () => {
    const h = renderToStaticMarkup(
      <Visor
        estado={{
          tipo: 'trabalho',
          trabalho: { titulo: 'Meu TCC', tipo: 'Genérico', salvamento: { tipo: 'naoSalvo' }, naoConformidades: 2, exportacao: 0.5 },
        }}
      />,
    );
    expect(h).toContain('Meu TCC');
    expect(h).toContain('Genérico');
    expect(h).toContain('Exportando DOCX… 50%');
    expect(h).toContain('2 não conformidades');
    expect(h).toContain('<progress');
  });
});

describe('aba Escrever (M1-T11)', () => {
  const nada = () => {};
  function escrever(estado: EstadoSessao, p: Partial<PropsAreaEscrever> = {}): string {
    const props: PropsAreaEscrever = {
      estado,
      rotuloDescartar: 'Fechar sem salvar',
      ocupado: false,
      aoAlterarTitulo: nada,
      elementos: { alterarDados: nada, alterarSubtitulo: nada, alterar: nada, incluir: () => null, retirar: () => false },
      obras: { incluir: () => ({ ok: false, mensagem: '' }), alterar: () => ({ ok: false, mensagem: '' }), excluir: () => ({ ok: false, mensagem: '' }), verificar: () => [], importar: () => ({ ok: false, mensagem: '' }) },
      aoSalvar: nada,
      aoFechar: nada,
      aoAcao: nada,
      aoCriar: nada,
      aoAbrir: nada,
      aoIrParaBiblioteca: nada,
      lerSecao: () => null,
      aoAlterarSecao: nada,
      estrutura: {
        memoria: new MemoriaEditores(),
        ativa: null,
        escolher: nada,
        novaSecao: () => false,
        operar: () => false,
        moverJunto: () => false,
        historico: () => false,
        pedirFoco: nada,
        pedidoFoco: null,
        consumirFoco: nada,
        aviso: null,
        registrarTexto: nada,
      },
      controleEditor: { current: null },
      ...p,
    };
    return renderToStaticMarkup(<AreaEscrever {...props} />);
  }
  const trabalho = {
    nomeArquivo: 'Trabalho sem título.bdp',
    titulo: 'Qualidade da água',
    tipoTrabalho: 'generico',
    somenteLeitura: false,
    podeSalvar: true,
    salvamento: { tipo: 'naoSalvo' },
    geracao: 1,
    secoes: [], preTextuais: null, obras: [],
  } as const;

  it('sem trabalho: convite para criar ou abrir', () => {
    const h = escrever({ trabalho: null, avisos: [] });
    expect(h).toContain('Nenhum trabalho aberto');
    expect(h).toContain('Novo trabalho');
    expect(h).toContain('Abrir…');
    expect(h).not.toContain('campo-titulo');
  });

  it('com trabalho: campo do título rotulado, Salvar (Ctrl+S), Fechar (Ctrl+W), arquivo e tipo', () => {
    const h = escrever({ trabalho, avisos: [] });
    expect(h).toMatch(/<label for="campo-titulo">Título do trabalho<\/label>/);
    expect(h).toMatch(/id="campo-titulo"[^>]*value="Qualidade da água"/);
    expect(h).not.toMatch(/id="campo-titulo"[^>]*readOnly/i);
    expect(h).toMatch(/aria-keyshortcuts="Control\+S"[^>]*>Salvar</);
    expect(h).toMatch(/aria-keyshortcuts="Control\+W"[^>]*>Fechar trabalho</);
    expect(h).toContain('Trabalho sem título.bdp');
    expect(h).toContain('Genérico');
    expect(h).toContain('30 segundos');
  });

  it('aviso de erro é alerta e traz "Salvar como…" e o descartar com o rótulo pedido', () => {
    const h = escrever(
      { trabalho, avisos: [{ nivel: 'erro', texto: 'Em uso por outro programa.', acoes: ['salvarComo', 'descartar'] }] },
      { rotuloDescartar: 'Sair sem salvar' },
    );
    expect(h).toMatch(/<li class="aviso aviso--erro">.*?role="alert">Em uso por outro programa\.<\/span>/);
    expect(h).toContain('>Salvar como…</button>');
    expect(h).toContain('>Sair sem salvar</button>');
  });

  it('sem destino (.bdp): Salvar vira "Salvar como…"; só leitura: campo travado e sem botão de gravar', () => {
    const semDestino = escrever({ trabalho: { ...trabalho, podeSalvar: false }, avisos: [] });
    expect(semDestino).toMatch(/aria-keyshortcuts="Control\+Shift\+S"[^>]*>Salvar como…</);
    expect(semDestino).not.toMatch(/>Salvar</);
    const leitura = escrever({ trabalho: { ...trabalho, podeSalvar: false, somenteLeitura: true, salvamento: { tipo: 'somenteLeitura' } }, avisos: [] });
    expect(leitura).toMatch(/id="campo-titulo"[^>]*readOnly=""/);
    expect(leitura).not.toContain('Salvar como…');
    expect(leitura).toContain('Somente leitura');
  });

  it('título com marcação vai como texto', () => {
    const h = escrever({ trabalho: { ...trabalho, titulo: '<img src=x onerror=alert(1)>' }, avisos: [] });
    expect(h).not.toContain('<img');
  });
});

describe('painel de detalhes e menus (M1-T11)', () => {
  it('ações do painel: Abrir, Renomear, Duplicar e Excluir; ilegível não abre nem duplica', () => {
    const acoes = { aoAbrir: () => {}, aoRenomear: async () => ({ ok: true as const, id: 'x' }), aoDuplicar: () => {}, aoExcluir: () => {} };
    const ok = renderToStaticMarkup(<PainelDetalhes item={item()} aoFechar={() => {}} {...acoes} />);
    for (const r of ['>Abrir<', '>Renomear…<', '>Duplicar<', '>Excluir…<']) expect(ok).toContain(r);
    const ruim = renderToStaticMarkup(<PainelDetalhes item={item({ estado: 'invalido', tipoTrabalho: null })} aoFechar={() => {}} {...acoes} />);
    expect(ruim).not.toContain('>Abrir<');
    expect(ruim).not.toContain('>Duplicar<');
    expect(ruim).toContain('>Excluir…<');
    const futuro = renderToStaticMarkup(<PainelDetalhes item={item({ estado: 'versaoFutura', tipoTrabalho: null })} aoFechar={() => {}} {...acoes} />);
    expect(futuro).toContain('>Abrir<');
    expect(futuro).toContain('só para leitura');
  });

  it('com trabalho aberto, o visor mostra título e "Alterações não salvas"', () => {
    const h = renderToStaticMarkup(
      <Visor estado={{ tipo: 'trabalho', trabalho: { titulo: 'Meu TCC', tipo: 'Genérico', salvamento: { tipo: 'naoSalvo' }, naoConformidades: null, exportacao: null } }} />,
    );
    expect(h).toContain('role="status"');
    expect(h).toContain('Alterações não salvas');
    expect(h).not.toContain('nenhum trabalho aberto');
  });
});

describe('árvore de seções (M2-T07)', () => {
  const secoes = resumirSecoes([
    { id: 'sec_introducao01', titulo: [{ tipo: 'texto', texto: 'Introdução' }], blocos: [], subsecoes: [] },
    {
      id: 'sec_metodo000001',
      titulo: [{ tipo: 'texto', texto: 'Método' }],
      blocos: [],
      subsecoes: [{ id: 'sec_coleta000001', titulo: [], blocos: [], subsecoes: [] }],
    },
  ]);
  function arvore(p: Partial<PropsArvoreSecoes> = {}): string {
    const nada = () => {};
    return renderToStaticMarkup(
      <ArvoreSecoes
        secoes={secoes}
        ativaId="sec_coleta000001"
        somenteLeitura={false}
        aviso={null}
        refArvore={{ current: null }}
        aoEscolher={nada}
        aoNova={nada}
        aoOperar={nada}
        aoMover={nada}
        aoHistorico={() => false}
        aoIrAoTexto={nada}
        {...p}
      />,
    );
  }

  it('papel "tree" com nível, posição e irmãs em cada item; número e título como texto; só o ativo no Tab', () => {
    const h = arvore();
    expect(h).toContain('role="tree" aria-labelledby="titulo-lista-secoes"');
    expect(contarOcorrencias(h, 'role="treeitem"')).toBe(3);
    expect(h).toMatch(/aria-level="1" aria-posinset="1" aria-setsize="2" aria-selected="false" tabindex="-1"[^>]*>.*?>1<\/span> .*?>Introdução</);
    expect(h).toMatch(/aria-level="2" aria-posinset="1" aria-setsize="1" aria-selected="true" tabindex="0"[^>]*>.*?>2\.1<\/span> .*?>Sem título</);
    expect(contarOcorrencias(h, 'tabindex="0"')).toBe(1);
    expect(contarOcorrencias(h, 'draggable="true"')).toBe(3);
  });

  it('botões de estrutura com os atalhos; "Nova seção"; linha de estado viva', () => {
    const h = arvore({ aviso: { texto: 'A seção já é primária.', erro: true } });
    // A tecla vale na lista, não no botão: só na dica, sem `aria-keyshortcuts` (revisão do M2-T07, B7).
    for (const [rotulo, atalho] of [
      ['Subir seção', 'Alt\\+Shift\\+↑'],
      ['Descer seção', 'Alt\\+Shift\\+↓'],
      ['Recuar seção', 'Alt\\+Shift\\+→'],
      ['Promover seção', 'Alt\\+Shift\\+←'],
      ['Excluir seção', 'Delete'],
    ]) {
      expect(h).toMatch(new RegExp(`aria-label="${rotulo}" title="[^"]*na lista: ${atalho}`));
    }
    expect(h).not.toMatch(/aria-label="(Subir|Excluir) seção"[^>]*aria-keyshortcuts/);
    expect(h).toContain('>Nova seção</button>');
    expect(h).toMatch(/class="dica dica--erro" role="status">A seção já é primária\.</);
  });

  it('só leitura: sem botões nem arrastar; sem seções: dica', () => {
    const leitura = arvore({ somenteLeitura: true });
    expect(leitura).not.toContain('Nova seção');
    expect(leitura).not.toContain('Excluir seção');
    expect(leitura).toContain('draggable="false"');
    expect(arvore({ secoes: [], ativaId: null })).toContain('Este trabalho ainda não tem seções.');
  });

  it('título com marcação vai como texto', () => {
    const [s0] = resumirSecoes([{ id: 'sec_introducao01', titulo: [{ tipo: 'texto', texto: '<img src=x>' }], blocos: [], subsecoes: [] }]);
    expect(arvore({ secoes: [s0!], ativaId: null })).not.toContain('<img');
  });
});
