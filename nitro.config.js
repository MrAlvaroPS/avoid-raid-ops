import { defineConfig } from 'nitro';

export default defineConfig({
  // Nitro owns all server routes under routes/api/. Do not recreate a root-level api/ directory on Vercel.
  serverDir: './',

  // Workflow SDK v5's native Nitro integration bundles workflow routes into
  // Nitro's single Vercel output instead of generating a second __server.func.
  modules: ['workflow/nitro'],

  workflow: {
    runtime: 'nodejs22.x',
    sourcemap: 'inline',
  },
});
