/**
 * Single configurable product name (Stage 4). Set PRODUCT_NAME at deploy
 * time once the brand is decided; until then a neutral placeholder is used.
 * Never hard-code "Site Safi"/"Mjengo" in API strings, PDFs or sender names.
 */
export const PRODUCT_NAME = process.env.PRODUCT_NAME || 'BuildSasa';
