// Inventário de licenças de terceiros (M2-T11; C-19, RNF-15, R-M1-04). Parte do package-lock.json, sem dependência
// nova. Produção é o que não tem `dev`/`devOptional`: é o que vai no pacote, no asar ou embutido no bundle da interface.
//   node empacotamento/terceiros.cjs            grava recursos-build/TERCEIROS.txt
//   node empacotamento/terceiros.cjs --conferir falha se o arquivo estiver velho ou houver licença recusada
const { existsSync, readdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const RAIZ = join(__dirname, '..');
const DESTINO = join(RAIZ, 'recursos-build', 'TERCEIROS.txt');
const PREFIXO = 'node_modules/';

/** Licença fora desta lista exige decisão de uma pessoa: o inventário falha em vez de deixar passar. */
const PERMITIDAS = new Set(['MIT', 'ISC', '0BSD', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0']);

/** @param {{ packages: Record<string, { version?: string, license?: string, dev?: boolean, devOptional?: boolean }> }} trava */
function pacotesDeProducao(trava) {
  return Object.entries(trava.packages)
    .filter(([caminho, p]) => caminho.startsWith(PREFIXO) && !p.dev && !p.devOptional)
    .map(([caminho, p]) => ({
      caminho,
      nome: caminho.slice(caminho.lastIndexOf(PREFIXO) + PREFIXO.length),
      versao: p.version ?? '',
      licenca: p.license ?? '',
    }))
    .sort((a, b) => (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0));
}

/** Copyleft é recusado mesmo em expressão com alternativa (`MIT OR GPL-3.0`), e o desconhecido também. */
function licencasRecusadas(pacotes) {
  return pacotes.filter((p) => !PERMITIDAS.has(p.licenca));
}

function textoDaLicenca(raiz, caminho) {
  const pasta = join(raiz, caminho);
  const nome = readdirSync(pasta).find((n) => /^(licen[cs]e|copying)(\.|$)/i.test(n));
  return nome === undefined ? null : readFileSync(join(pasta, nome), 'utf8').replace(/\r\n/g, '\n').trim();
}

function gerarTexto(pacotes, raiz = RAIZ) {
  const partes = [
    'BiblioDocs Pro: componentes de terceiros',
    '',
    'Arquivo gerado por empacotamento/terceiros.cjs a partir do package-lock.json. Não editar à mão.',
    '',
    'O Electron e o Chromium, que acompanham o aplicativo, têm as licenças próprias nos arquivos',
    'LICENSE.electron.txt e LICENSES.chromium.html, nesta mesma pasta.',
  ];
  for (const p of pacotes) {
    const texto = textoDaLicenca(raiz, p.caminho);
    partes.push('', '-'.repeat(80), `${p.nome} ${p.versao} (${p.licenca})`, '-'.repeat(80), '');
    partes.push(texto ?? `O pacote não traz arquivo de licença; a licença declarada é ${p.licenca}.`);
  }
  return `${partes.join('\n')}\n`;
}

function principal() {
  const pacotes = pacotesDeProducao(JSON.parse(readFileSync(join(RAIZ, 'package-lock.json'), 'utf8')));
  const recusadas = licencasRecusadas(pacotes);
  if (recusadas.length > 0) {
    console.error(`Licença recusada: ${recusadas.map((p) => `${p.nome} (${p.licenca || 'sem licença'})`).join(', ')}`);
    return 1;
  }
  const texto = gerarTexto(pacotes);
  if (process.argv.includes('--conferir')) {
    const atual = existsSync(DESTINO) ? readFileSync(DESTINO, 'utf8').replace(/\r\n/g, '\n') : null;
    if (atual !== texto) {
      console.error('recursos-build/TERCEIROS.txt está velho: rode `node empacotamento/terceiros.cjs`.');
      return 1;
    }
    return 0;
  }
  writeFileSync(DESTINO, texto);
  return 0;
}

if (require.main === module) process.exitCode = principal();

module.exports = { DESTINO, PERMITIDAS, gerarTexto, licencasRecusadas, pacotesDeProducao };
