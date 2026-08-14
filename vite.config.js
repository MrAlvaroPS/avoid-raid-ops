import { defineConfig } from 'vite';
import { nitro } from 'nitro/vite';

// Workflow SDK is integrated through Nitro itself (workflow/nitro).
// Workflow is registered only through Nitro so a single component owns Vercel Build Output.
export default defineConfig({
  plugins: [nitro()],
});
