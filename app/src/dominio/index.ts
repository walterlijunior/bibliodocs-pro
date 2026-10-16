/**
 * Módulo `dominio` — núcleo em TypeScript puro: modelo, normas, bibliografia, visuais, numeracao, verificador, esquemas.
 *
 * Regras de dependência (ADR-0005, seção 2):
 * - Não importa nada de fora de dominio/ nem bibliotecas de plataforma: sem DOM, Node, Electron ou React (regra 1).
 * - zod só em dominio/esquemas. Sem DOM e sem Node (checado por tsconfig.puro.json).
 *
 * Marcador criado no M1-T01; a implementação vem nas tarefas seguintes.
 */
export {};
