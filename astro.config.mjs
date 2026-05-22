import { defineConfig } from 'astro/config';

// Set GITHUB_PAGES=1 at build time to emit URLs prefixed with the repo
// subpath (jedwan.github.io/zuluy/...). Local dev + previews stay at /.
const isPages = process.env.GITHUB_PAGES === '1';

export default defineConfig({
  site: 'https://jedwan.github.io',
  base: isPages ? '/zuluy' : undefined,
  output: 'static',
});
