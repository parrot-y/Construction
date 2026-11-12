/**
 * Single configurable product name (Stage 4). Set VITE_PRODUCT_NAME at
 * build time once the brand is decided; until then a neutral placeholder
 * is used. Brand is decided: SiteSafi.
 */
export const PRODUCT_NAME =
  (import.meta.env.VITE_PRODUCT_NAME as string | undefined) || 'SiteSafi';
