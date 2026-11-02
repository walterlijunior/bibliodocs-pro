/**
 * Perfil usado pelo aplicativo enquanto não há escolha de perfil (M3-T02). Só a aplicação carrega os dados: o domínio os
 * recebe por parâmetro (ADR-0005, regra 1). O arquivo faz parte do build e é validado por `tests/perfil.test.ts`.
 */
import dados from '../../perfis/uft-2022/perfil.json';
import type { Perfil } from '../dominio/normas';

export const PERFIL_UFT_2022 = dados as unknown as Perfil;
