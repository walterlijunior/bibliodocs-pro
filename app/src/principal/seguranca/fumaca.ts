/**
 * Marca do artefato de fumaça (`npm run dist:fumaca`) no package.json do ASAR. O instalador não a tem: o que depende dela
 * nunca vale para quem usa o aplicativo.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

export function ehArtefatoDeFumaca(): boolean {
  try {
    const pacote = JSON.parse(readFileSync(join(app.getAppPath(), 'package.json'), 'utf8')) as Record<string, unknown>;
    return pacote['bibliodocsFumaca'] === true;
  } catch {
    return false;
  }
}
