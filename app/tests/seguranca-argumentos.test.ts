// Testes do M1-T14 (achado A-1): argumentos de linha de comando recusados no app empacotado.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { argumentoRecusado, SAIDA_ARGUMENTO_RECUSADO } from '../src/principal/seguranca/argumentos';

describe('argumentoRecusado (A-1)', () => {
  it('sem argumentos, ou só com --updated (instalador NSIS), segue', () => {
    expect(argumentoRecusado([], false)).toBeNull();
    expect(argumentoRecusado(['--updated'], false)).toBeNull();
  });

  it.each([
    '--remote-debugging-port=9339',
    '--remote-debugging-pipe',
    '--remote-allow-origins=*',
    '--inspect=9229',
    '--inspect-brk',
    '--js-flags=--allow-natives-syntax',
    '--no-sandbox',
    '--renderer-cmd-prefix=calc',
    '--user-data-dir=C:\\x',
    '--proxy-server=http://mau:8080',
    '-remote-debugging-port=9339',
    '/remote-debugging-port=9339',
    '--updated=1',
    '--UPDATED',
  ])('recusa %s no instalador', (argumento) => {
    expect(argumentoRecusado([argumento], false)).toBe(argumento);
    expect(argumentoRecusado(['--updated', argumento], false)).toBe(argumento);
  });

  it('o que vem depois de -- é dado, não chave; antes de -- continua valendo', () => {
    expect(argumentoRecusado(['--', '--remote-debugging-port=1'], false)).toBeNull();
    expect(argumentoRecusado(['--', '/caminho/arquivo.bdp'], false)).toBeNull();
    expect(argumentoRecusado(['--no-sandbox', '--', 'x'], false)).toBe('--no-sandbox');
  });

  it('caminho de arquivo sem barra inicial não é chave', () => {
    expect(argumentoRecusado(['C:\\Users\\a\\Documentos\\t.bdp'], false)).toBeNull();
  });

  it('a fumaça aceita só a porta, o perfil e o net-log', () => {
    const fumaca = ['--user-data-dir=C:\\t\\perfil', '--remote-debugging-port=9339', '--log-net-log=C:\\t\\n.json'];
    expect(argumentoRecusado(fumaca, true)).toBeNull();
    expect(argumentoRecusado(fumaca, false)).toBe(fumaca[0]);
    for (const outro of ['--remote-debugging-address=0.0.0.0', '--remote-debugging-port=1', '--inspect', '--no-sandbox']) {
      expect(argumentoRecusado([...fumaca, outro], true)).toBe(outro);
    }
  });

  it('sai com código 2', () => {
    expect(SAIDA_ARGUMENTO_RECUSADO).toBe(2);
  });
});

describe('ligação no processo principal', () => {
  const fonte = readFileSync(join(__dirname, '..', 'src', 'principal', 'index.ts'), 'utf8');

  it('a checagem vem antes da instância única e de qualquer chave do Chromium', () => {
    const corpo = fonte.slice(fonte.indexOf('function iniciar(): void {'));
    const checagem = corpo.indexOf('argumentoRecusado(process.argv.slice(1)');
    expect(checagem).toBeGreaterThan(0);
    expect(checagem).toBeLessThan(corpo.indexOf('requestSingleInstanceLock'));
    expect(checagem).toBeLessThan(corpo.indexOf('appendSwitch'));
    expect(corpo.slice(0, checagem)).toContain('if (app.isPackaged)');
    expect(corpo.slice(checagem, corpo.indexOf('requestSingleInstanceLock'))).toContain('app.exit(SAIDA_ARGUMENTO_RECUSADO)');
  });
});
