// Testes do M2-T10 (ADR-0004, seção 4; R-M1-03): cópia antes de gravar, intervalo de 10 minutos e rotação. Disco real em
// pasta temporária; falhas injetadas pela interface `SistemaArquivos`.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BACKUPS_RECENTES,
  backupsParaApagar,
  dataDoBackup,
  fazerBackupRotativo,
  nomeBackupRotativo,
  SISTEMA_ARQUIVOS_NODE,
} from '../src/persistencia';

const ID = 'prj_abcdefghijklmnop';
const AGORA = new Date(2026, 10, 2, 12, 0, 0);
const minutos = (n: number) => new Date(AGORA.getTime() - n * 60_000);
const dias = (n: number, hora = 9) => new Date(2026, 10, 2 - n, hora, 0, 0);

let raiz: string;
let origem: string;
let pastaBackups: string;
beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), 'bdp-backups-'));
  origem = join(raiz, 'T.bdp');
  pastaBackups = join(raiz, 'backups');
  writeFileSync(origem, 'versao 1');
});
afterEach(() => rmSync(raiz, { recursive: true, force: true }));

const pasta = () => join(pastaBackups, ID);
const fazer = (agora = AGORA) => fazerBackupRotativo(origem, pastaBackups, ID, { agora: () => agora });

describe('nomes', () => {
  it('ida e volta em hora local', () => {
    expect(nomeBackupRotativo(AGORA)).toBe('20261102-120000.bdp');
    expect(dataDoBackup('20261102-120000.bdp')).toEqual(AGORA);
  });

  it.each(['20261102-120000-123-formato-v1.bdp', '20260231-120000.bdp', '20261102-120000.bdp.tmp', 'x.bdp', '20261102-256000.bdp'])('%s não é backup rotativo', (n) => {
    expect(dataDoBackup(n)).toBeNull();
  });
});

describe('rotação', () => {
  it('do mesmo dia, além dos 10, sai o mais antigo; o mais recente do dia fica', () => {
    const nomes = Array.from({ length: 13 }, (_, i) => nomeBackupRotativo(minutos(i * 10)));
    // Todos em 02/11, entre 10h00 e 12h00. O mais recente do dia está entre os 10; saem o 11.º, o 12.º e o 13.º.
    expect(backupsParaApagar(nomes, AGORA)).toEqual([nomes[10], nomes[11], nomes[12]]);
  });

  it('além dos 10, fica o mais recente de cada um dos últimos 7 dias; o 8.º dia sai', () => {
    const hoje = Array.from({ length: 10 }, (_, i) => nomeBackupRotativo(minutos(i * 10)));
    const antigos = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => nomeBackupRotativo(dias(n)));
    const doOntemMaisCedo = nomeBackupRotativo(dias(1, 7));
    // 02/11 é o dia 0: valem de 27/10 a 02/11. `dias(6)` fica; `dias(7)` e `dias(8)` saem.
    expect(backupsParaApagar([...hoje, ...antigos, doOntemMaisCedo], AGORA).sort()).toEqual([doOntemMaisCedo, nomeBackupRotativo(dias(7)), nomeBackupRotativo(dias(8))].sort());
  });

  it('dia sem backup novo não empurra os antigos: poucos arquivos ficam todos, mesmo velhos', () => {
    const nomes = [nomeBackupRotativo(dias(300)), nomeBackupRotativo(dias(100))];
    expect(backupsParaApagar(nomes, AGORA)).toEqual([]);
  });

  it('nunca escolhe backup de migração nem arquivo desconhecido', () => {
    const hoje = Array.from({ length: 12 }, (_, i) => nomeBackupRotativo(dias(30 + i)));
    const r = backupsParaApagar([...hoje, '20200101-000000-000-formato-v1.bdp', 'nota.txt'], AGORA);
    expect(r).toHaveLength(2);
    expect(r).not.toContain('20200101-000000-000-formato-v1.bdp');
    expect(r).not.toContain('nota.txt');
  });
});

describe('fazerBackupRotativo', () => {
  it('copia a versão anterior, sem temporário, e o original fica', async () => {
    expect(await fazer()).toEqual({ feito: true, nome: '20261102-120000.bdp', avisos: [] });
    expect(readdirSync(pasta())).toEqual(['20261102-120000.bdp']);
    expect(readFileSync(join(pasta(), '20261102-120000.bdp'), 'utf8')).toBe('versao 1');
    expect(readFileSync(origem, 'utf8')).toBe('versao 1');
  });

  it('arquivo novo não tem versão anterior', async () => {
    rmSync(origem);
    expect(await fazer()).toEqual({ feito: false, motivo: 'SEM_ARQUIVO' });
    expect(existsSync(pasta())).toBe(false);
  });

  it('no máximo um a cada 10 minutos, também depois de reiniciar (a data vem do nome)', async () => {
    expect(await fazer()).toMatchObject({ feito: true });
    expect(await fazer(new Date(AGORA.getTime() + 9 * 60_000 + 59_000))).toEqual({ feito: false, motivo: 'INTERVALO' });
    expect(await fazer(new Date(AGORA.getTime() + 10 * 60_000))).toMatchObject({ feito: true });
  });

  it('o backup de migração não conta para o intervalo nem é apagado', async () => {
    mkdirSync(pasta(), { recursive: true });
    const migracao = '20261102-115959-000-formato-v1.bdp';
    writeFileSync(join(pasta(), migracao), 'antes de migrar');
    expect(await fazer()).toMatchObject({ feito: true });
    for (let i = 1; i <= 15; i++) await fazer(new Date(AGORA.getTime() + i * 11 * 60_000));
    expect(readFileSync(join(pasta(), migracao), 'utf8')).toBe('antes de migrar');
  });

  it('relógio atrasado: backup com data futura não trava os novos nem é substituído', async () => {
    const futuro = new Date(2030, 0, 1);
    mkdirSync(pasta(), { recursive: true });
    writeFileSync(join(pasta(), nomeBackupRotativo(futuro)), 'do futuro');
    expect(await fazer()).toMatchObject({ feito: true });
    expect(readFileSync(join(pasta(), nomeBackupRotativo(futuro)), 'utf8')).toBe('do futuro');
  });

  it('a rotação roda a cada backup', async () => {
    for (let i = 0; i < 14; i++) await fazer(new Date(AGORA.getTime() + i * 11 * 60_000));
    expect(readdirSync(pasta())).toHaveLength(BACKUPS_RECENTES);
  });

  it.each(['../fora', 'a/b', 'a\\b', '..', 'curto', ''])('id %j não vira pasta', async (id) => {
    expect(await fazerBackupRotativo(origem, pastaBackups, id, { agora: () => AGORA })).toEqual({ feito: false, motivo: 'ID_INVALIDO' });
    expect(existsSync(pastaBackups)).toBe(false);
  });

  it('falha ao copiar é devolvida, sem lançar e sem deixar temporário', async () => {
    const fs = { ...SISTEMA_ARQUIVOS_NODE, renomear: () => Promise.reject(Object.assign(new Error('x'), { code: 'EPERM' })) };
    expect(await fazerBackupRotativo(origem, pastaBackups, ID, { fs, agora: () => AGORA })).toEqual({ feito: false, motivo: 'FALHOU', codigo: 'EPERM' });
    expect(readdirSync(pasta())).toEqual([]);
  });

  it('temporário de uma queda anterior não impede o backup', async () => {
    mkdirSync(pasta(), { recursive: true });
    writeFileSync(join(pasta(), '20261102-120000.bdp.tmp'), 'metade');
    expect(await fazer()).toMatchObject({ feito: true });
    expect(readdirSync(pasta())).toEqual(['20261102-120000.bdp']);
  });

  it('falha ao apagar um antigo vira aviso: o backup novo vale', async () => {
    for (let i = 0; i < 10; i++) await fazer(new Date(AGORA.getTime() - (i + 1) * 3 * 24 * 3_600_000));
    const fs = { ...SISTEMA_ARQUIVOS_NODE, apagar: (c: string) => (c.endsWith('.tmp') ? SISTEMA_ARQUIVOS_NODE.apagar(c) : Promise.reject(Object.assign(new Error('x'), { code: 'EBUSY' }))) };
    expect(await fazerBackupRotativo(origem, pastaBackups, ID, { fs, agora: () => AGORA })).toEqual({ feito: true, nome: '20261102-120000.bdp', avisos: ['EBUSY'] });
  });
});
