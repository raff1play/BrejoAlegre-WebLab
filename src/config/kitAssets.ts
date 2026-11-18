/**
 * EXPERIMENTO (branch isolada, fora do B1-01): carros GLB de terceiros e peças do
 * "City Kit Roads" (Kenney, CC0) no lugar das versões procedurais.
 *
 * Ligado por padrão nesta branch; `?kit=0` na URL volta ao visual procedural original,
 * para comparar lado a lado. Simulação, trânsito, colisões e lógica não mudam.
 */
export const KIT_ASSETS: boolean = typeof window === 'undefined'
  || new URLSearchParams(window.location.search).get('kit') !== '0';
