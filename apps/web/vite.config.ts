import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Security headers — parity with apps/web/nginx.conf so dev/preview and
// production emit identical policy (CSP on in every served environment).
const cspDirectives =
  "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "img-src 'self' data: blob:; font-src 'self' data: https://fonts.gstatic.com; " +
  "worker-src 'self'; manifest-src 'self'";

// Production/preview CSP: scripts only from 'self' — the built SPA has no
// inline scripts. Dev CSP additionally allows exactly one hashed inline
// script: the @vitejs/plugin-react refresh preamble (sha256 of its exact
// text, verified against the served index.html). No 'unsafe-inline' anywhere.
const VITE_REACT_PREAMBLE_SHA256 = 'sha256-Z2/iFzh9VMlVkEOar1f/oSHWwQk3ve1qk/C2WdsC4Xk=';
const prodHeaders = {
  'Content-Security-Policy': `${cspDirectives}; script-src 'self'; connect-src 'self' https:; upgrade-insecure-requests`,
};
const devHeaders = {
  'Content-Security-Policy': `${cspDirectives}; script-src 'self' '${VITE_REACT_PREAMBLE_SHA256}'; connect-src 'self' https: ws: wss:; upgrade-insecure-requests`,
};
const securityHeaders = {
  ...prodHeaders,
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};
const devSecurityHeaders = { ...securityHeaders, ...devHeaders };

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: process.env.VITE_PRODUCT_NAME || 'SiteSafi',
        short_name: process.env.VITE_PRODUCT_NAME || 'SiteSafi',
        description: 'Kenya-first construction management — sites, crews, money, clients',
        theme_color: '#EA580C',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
    headers: devSecurityHeaders,
    proxy: {
      '/api': { target: process.env.VITE_API_TARGET || 'http://localhost:4100', changeOrigin: true },
      '/uploads': { target: process.env.VITE_API_TARGET || 'http://localhost:4100', changeOrigin: true },
    },
  },
  preview: {
    headers: securityHeaders,
    proxy: {
      '/api': { target: process.env.VITE_API_TARGET || 'http://localhost:4100', changeOrigin: true },
      '/uploads': { target: process.env.VITE_API_TARGET || 'http://localhost:4100', changeOrigin: true },
    },
  },
});
