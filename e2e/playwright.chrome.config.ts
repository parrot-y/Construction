import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Local runs on machines where the Playwright CDN is unreachable: use the
// system Google Chrome instead of the bundled chromium build, and skip the
// ffmpeg-dependent video artifact.
export default defineConfig({
  ...base,
  use: { ...base.use, channel: 'chrome', video: 'off' },
});
