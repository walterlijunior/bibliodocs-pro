// M1-T03 — Fronteiras entre módulos (ADR-0005, seção 2, regras 1 a 6; ADR-0006, camada 3 "Arquitetura").
// O analisador (tests/apoio/analisador-fontes.ts) é puro: os casos negativos usam arquivos sintéticos em
// memória e nenhum arquivo violador fica em src/.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  analisarLexico,
  classificarDestino,
  extrairImportacoes,
  formatarViolacao,
  moduloDoCaminho,
  verificarFronteiras,
  type ArquivoFonte,
} from './apoio/analisador-fontes';
import { lerFontesDoSrc } from './apoio/ler-fontes';

const raizApp = join(__dirname, '..');
const fontes = lerFontesDoSrc(raizApp);

/** Violações de um único arquivo sintético. */
const violacoesDe = (arquivo: string, conteudo: string) => verificarFronteiras([{ arquivo, conteudo }]);

describe('ARQ — fronteiras do código real em src/ (ADR-0005, regras 1–6)', () => {
  it('a varredura encontra os arquivos e as importações reais (não é vazia)', () => {
    expect(fontes.length).toBeGreaterThanOrEqual(20);
    const principal = fontes.find((f) => f.arquivo === 'src/principal/index.ts');
    expect(principal).toBeDefined();
    const especificadores = extrairImportacoes(principal!.conteudo).map((i) => i.especificador);
    expect(especificadores).toEqual(expect.arrayContaining(['node:path', 'electron', './seguranca/politica-urls']));
    const main = fontes.find((f) => f.arquivo === 'src/interface/main.tsx');
    expect(extrairImportacoes(main!.conteudo).map((i) => i.especificador)).toEqual(
      expect.arrayContaining(['react', 'react-dom/client', './Aplicativo']),
    );
  });

  it('todo arquivo de src/ pertence a um módulo previsto no ADR-0005', () => {
    const fora = fontes.filter((f) => moduloDoCaminho(f.arquivo).startsWith('desconhecido:')).map((f) => f.arquivo);
    expect(fora, `arquivos fora dos módulos do ADR-0005:\n${fora.join('\n')}`).toEqual([]);
  });

  it('nenhuma importação viola as regras 1 a 6', () => {
    const violacoes = verificarFronteiras(fontes).map(formatarViolacao);
    expect(violacoes, `violações de fronteira:\n${violacoes.join('\n')}`).toEqual([]);
  });
});

describe('ARQ — analisador de importações', () => {
  it('reconhece import/export from, import type, efeito, import(), require() e /// <reference>', () => {
    const codigo = [
      "import padrao, { a, type B as C } from './a';",
      "import type { T } from '../tipos';",
      "import { type X, type Y } from './so-tipos';",
      "export * from './reexporta';",
      "export type { Z } from './tipo-reexportado';",
      "import './efeito.css';",
      "const m = await import('./dinamico');",
      "const r = require('fs');",
      'const calc = await import(caminho);',
      '/// <reference types="node" />',
      'import {',
      '  multi,',
      '  linha,',
      "} from 'pacote/sub';",
    ].join('\n');
    const imps = extrairImportacoes(codigo);
    const resumo = imps.map((i) => [i.tipo, i.especificador, i.somenteTipo, i.linha]);
    expect(resumo).toEqual([
      ['estatica', './a', false, 1],
      ['estatica', '../tipos', true, 2],
      ['estatica', './so-tipos', true, 3],
      ['reexportacao', './reexporta', false, 4],
      ['reexportacao', './tipo-reexportado', true, 5],
      ['efeito', './efeito.css', false, 6],
      ['dinamica', './dinamico', false, 7],
      ['require', 'fs', false, 8],
      ['dinamica', null, false, 9],
      ['referencia', 'node', true, 10],
      ['estatica', 'pacote/sub', false, 11],
    ]);
    expect(imps[0]!.nomes).toEqual(['default', 'a', 'B']);
  });

  it('ignora importações dentro de comentários e strings', () => {
    const codigo = [
      "// import { app } from 'electron';",
      "/* const x = require('node:fs'); */",
      "const texto = \"import x from 'electron'\";",
      "const t = `require('child_process')`;",
      "export const ok = 1;",
    ].join('\n');
    expect(extrairImportacoes(codigo)).toEqual([]);
  });

  it('léxico: regex com // e strings com https:// não viram comentário', () => {
    const codigo = "const r = /\\/\\//g; const u = 'https://x'; // fim\nimport { a } from './a';";
    const { soCodigo, semComentarios } = analisarLexico(codigo);
    expect(soCodigo.length).toBe(codigo.length);
    expect(semComentarios).toContain("'https://x'");
    expect(semComentarios).not.toContain('fim');
    expect(soCodigo).not.toContain('https');
    expect(extrairImportacoes(codigo).map((i) => i.especificador)).toEqual(['./a']);
  });

  it('léxico: expressões dentro de template são código', () => {
    const { soCodigo } = analisarLexico('const t = `a ${f(1, { b: 2 })} c ${g()}`; h();');
    expect(soCodigo).toContain('f(1, { b: 2 })');
    expect(soCodigo).toContain('g()');
    expect(soCodigo).toContain('h();');
    expect(soCodigo).not.toMatch(/\ba\b|\bc\b/);
  });

  it('classifica destinos e módulos', () => {
    const imp = (especificador: string) => extrairImportacoes(`import x from '${especificador}';`)[0]!;
    expect(classificarDestino('src/dominio/numeracao/a.ts', imp('../modelo'))).toEqual({
      tipo: 'interno', caminho: 'src/dominio/modelo', modulo: 'dominio/modelo',
    });
    expect(classificarDestino('src/x/a.ts', imp('node:fs')).tipo).toBe('node');
    expect(classificarDestino('src/x/a.ts', imp('fs/promises')).tipo).toBe('node');
    expect(classificarDestino('src/x/a.ts', imp('electron/main')).tipo).toBe('electron');
    expect(classificarDestino('src/x/a.ts', imp('@scope/pkg/sub'))).toEqual({ tipo: 'pacote', nome: '@scope/pkg' });
    expect(moduloDoCaminho('src/principal')).toBe('principal');
    expect(moduloDoCaminho('src/principal.ts')).toBe('desconhecido:principal.ts');
    expect(moduloDoCaminho('src/dominio/index.ts')).toBe('dominio');
    expect(moduloDoCaminho('src/dominio/normas/formatado.ts')).toBe('dominio/normas');
    expect(moduloDoCaminho('src/exportacao/docx/estilos/x.ts')).toBe('exportacao/docx');
    expect(moduloDoCaminho('src/utilidades/x.ts')).toBe('desconhecido:utilidades');
    expect(moduloDoCaminho('src/dominio/novo/x.ts')).toBe('desconhecido:dominio/novo');
    expect(moduloDoCaminho('perfis/uft-2022/a.json')).toBe('fora-de-src');
  });
});

/**
 * Casos negativos sintéticos (critério de aceite do M1-T03): ao menos um por regra.
 * [arquivo, conteúdo, regra esperada na mensagem]
 */
const NEGATIVOS: readonly [string, string, string][] = [
  // Regra 1 — domínio só importa domínio; zod só em esquemas.
  ['src/dominio/modelo/v1.ts', "import { app } from 'electron';", 'regra 1'],
  ['src/dominio/normas/v2.ts', "import { readFileSync } from 'node:fs';", 'regra 1'],
  ['src/dominio/numeracao/v3.ts', "import { z } from 'zod';", 'regra 1'],
  ['src/dominio/modelo/v4.ts', "import React from 'react';", 'regra 1'],
  ['src/dominio/bibliografia/v5.ts', "import { x } from '../../aplicacao';", 'regra 1'],
  ['src/dominio/visuais/v6.ts', "const fs = require('fs');", 'regra 1'],
  ['src/dominio/normas/v7.ts', "import perfil from '../../../perfis/uft-2022/perfil.json';", 'regra 1'],
  ['src/dominio/modelo/v8.ts', '/// <reference types="node" />', 'regra 1'],
  ['src/dominio/modelo/v9.ts', "import type { BrowserWindow } from 'electron';", 'regra 1'],
  // Regra 2 — direção interna do domínio.
  ['src/dominio/modelo/v10.ts', "import { n } from '../numeracao';", 'regra 2'],
  ['src/dominio/numeracao/v11.ts', "import type { Obra } from '../bibliografia/obra';", 'regra 2'],
  ['src/dominio/bibliografia/v12.ts', "import { Tabela } from '../visuais';", 'regra 2'],
  ['src/dominio/visuais/v13.ts', "import { formatar } from '../normas';", 'regra 2'],
  ['src/dominio/normas/v14.ts', "import { verificar } from '../verificador';", 'regra 2'],
  ['src/dominio/esquemas/v15.ts', "import { formatar } from '../normas/motor';", 'regra 2'],
  ['src/dominio/normas/v16.ts', "import { esquema } from '../esquemas';", 'regra 2'],
  ['src/dominio/index.ts', "export * from './verificador';", 'regra 2'],
  ['src/dominio/index.ts', "export * from './normas';", 'regra 2'],
  // Regra 3 — aplicação.
  ['src/aplicacao/v17.ts', "import { Aplicativo } from '../interface/Aplicativo';", 'regra 3'],
  ['src/aplicacao/v18.ts', "import { criarJanela } from '../principal';", 'regra 3'],
  ['src/aplicacao/v19.ts', "import { ipcMain } from 'electron';", 'regra 3'],
  ['src/aplicacao/v20.ts', "import { join } from 'node:path';", 'regra 3'],
  ['src/aplicacao/v20b.ts', "import { salvarBdp } from '../persistencia';", 'regra 3'],
  ['src/aplicacao/v20c.ts', "import { revisar } from '../integracoes';", 'regra 3'],
  // Regra 4 — interface.
  ['src/interface/v21.tsx', "import { formatar } from '../dominio/normas';", 'regra 4'],
  ['src/interface/v22.tsx', "import type { Perfil } from '../dominio/normas/perfil';", 'regra 4'],
  ['src/interface/v23.tsx', "import { BLOCO } from '../dominio/normas/formatado';", 'regra 4'],
  ['src/interface/v24.tsx', "import { criarSecao } from '../dominio/modelo';", 'regra 4'],
  ['src/interface/v25.tsx', "import { salvar } from '../persistencia';", 'regra 4'],
  ['src/interface/v26.tsx', "import { x } from '../principal/seguranca/csp';", 'regra 4'],
  ['src/interface/v27.tsx', "import { y } from '../integracoes';", 'regra 4'],
  ['src/interface/v28.tsx', "import { ipcRenderer } from 'electron';", 'regra 4'],
  ['src/interface/v29.tsx', "import { readFile } from 'node:fs/promises';", 'regra 4'],
  ['src/interface/v30.tsx', "import perfil from '../../perfis/uft-2022/perfil.json';", 'regra 4'],
  // Regra 5 — exportação DOCX.
  ['src/exportacao/docx/v31.ts', "import type { Documento } from '../../dominio/modelo';", 'regra 5'],
  ['src/exportacao/docx/v32.ts', "import type { Perfil } from '../../dominio/normas/perfil';", 'regra 5'],
  ['src/exportacao/docx/v33.ts', "import { BLOCO } from '../../dominio/normas/formatado';", 'regra 5'],
  ['src/exportacao/docx/v34.ts', "import JSZip from 'jszip';", 'regra 5'],
  ['src/exportacao/docx/v35.ts', "import { writeFile } from 'node:fs/promises';", 'regra 5'],
  ['src/exportacao/docx/v36.ts', "import { app } from 'electron';", 'regra 5'],
  // Regra 6 — plataforma só em principal, persistencia, integracoes (+ electron no preload).
  ['src/importacao/v37.ts', "import { readFile } from 'node:fs/promises';", 'regra 6'],
  ['src/importacao/v38.ts', "import { spawn } from 'child_process';", 'regra 6'],
  ['src/preload/v39.ts', "import { readFileSync } from 'node:fs';", 'regra 6'],
  ['src/importacao/v40.ts', "import { dialog } from 'electron';", 'regra 6'],
  // Não verificável / fora do mapa.
  ['src/principal/v41.ts', 'const m = await import(nomeCalculado);', 'regras 1–6'],
  ['src/principal/v42.ts', 'const m = require(`./${nome}`);', 'regras 1–6'],
  ['src/utilidades/v43.ts', 'export const x = 1;', 'seção 1'],
  ['src/principal/v44.ts', "import { u } from '../utilidades/u';", 'seção 1'],
];

describe('ARQ — casos negativos sintéticos (o verificador detecta a violação)', () => {
  it.each(NEGATIVOS)('%s: %s → %s', (arquivo, conteudo, regra) => {
    const violacoes = violacoesDe(arquivo, conteudo);
    expect(violacoes.length, `esperava violação (${regra}) e não houve`).toBeGreaterThan(0);
    const mensagem = formatarViolacao(violacoes[0]!);
    expect(mensagem).toContain(regra);
    expect(mensagem).toContain(arquivo);
  });

  it('a mensagem cita arquivo, linha, import e regra', () => {
    const [v] = violacoesDe('src/dominio/modelo/_violacao.ts', "export const a = 1;\nimport { app } from 'electron';");
    expect(formatarViolacao(v!)).toBe(
      "src/dominio/modelo/_violacao.ts:2 — import 'electron' — ADR-0005 regra 1: domínio não usa plataforma: 'electron'",
    );
  });
});

/** Casos positivos: o que as regras permitem não pode virar falso positivo. */
const POSITIVOS: readonly ArquivoFonte[] = [
  { arquivo: 'src/dominio/numeracao/p1.ts', conteudo: "import type { Secao } from '../modelo';" },
  { arquivo: 'src/dominio/bibliografia/p2.ts', conteudo: "import { a } from '../modelo/arvore';\nimport { b } from '../numeracao';" },
  { arquivo: 'src/dominio/visuais/p3.ts', conteudo: "import { n } from '../numeracao/contador';" },
  { arquivo: 'src/dominio/normas/p4.ts', conteudo: "import { o } from '../bibliografia';\nimport { t } from '../visuais';\nimport { m } from '../modelo';" },
  { arquivo: 'src/dominio/normas/p5.ts', conteudo: "import type { BlocoFormatado } from './formatado';" },
  { arquivo: 'src/dominio/verificador/p6.ts', conteudo: "import { formatar } from '../normas';\nimport { esquema } from '../esquemas';" },
  { arquivo: 'src/dominio/esquemas/p7.ts', conteudo: "import { z } from 'zod';\nimport type { Documento } from '../modelo';" },
  { arquivo: 'src/dominio/index.ts', conteudo: "export * from './modelo';\nexport * from './esquemas';" },
  { arquivo: 'src/aplicacao/p8.ts', conteudo: "import { formatar } from '../dominio/normas';\nimport { verificar } from '../dominio/verificador';" },
  { arquivo: 'src/interface/p9.tsx', conteudo: "import { useState } from 'react';\nimport type { DocumentoFormatado } from '../dominio/normas/formatado';\nimport { type Documento } from '../dominio/modelo';\nimport { criar } from '../aplicacao';" },
  { arquivo: 'src/exportacao/docx/p10.ts', conteudo: "import { Document, Packer } from 'docx';\nimport type { DocumentoFormatado } from '../../dominio/normas/formatado';\nimport { estilos } from './estilos';" },
  { arquivo: 'src/exportacao/index.ts', conteudo: "export * from './docx';" },
  { arquivo: 'src/preload/p11.ts', conteudo: "import { contextBridge, ipcRenderer } from 'electron';" },
  { arquivo: 'src/persistencia/p12.ts', conteudo: "import { rename } from 'node:fs/promises';\nimport type { Documento } from '../dominio/modelo';" },
  { arquivo: 'src/integracoes/p13.ts', conteudo: "import { spawn } from 'node:child_process';" },
  { arquivo: 'src/principal/p14.ts', conteudo: "import { app } from 'electron';\nimport { join } from 'path';" },
];

describe('ARQ — casos positivos (sem falso positivo)', () => {
  it('importações permitidas pelo ADR-0005 não geram violação', () => {
    const violacoes = verificarFronteiras(POSITIVOS).map(formatarViolacao);
    expect(violacoes, violacoes.join('\n')).toEqual([]);
  });
});
