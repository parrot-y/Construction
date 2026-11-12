/**
 * Single configurable product name (Stage 4). Set PRODUCT_NAME at deploy
 * time once the brand is decided; until then a neutral placeholder is used.
 * Brand is decided: SiteSafi.
 */
export const PRODUCT_NAME = process.env.PRODUCT_NAME || 'SiteSafi';
