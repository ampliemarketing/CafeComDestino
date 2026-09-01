import path from 'path';
import { defineConfig } from 'vitest/config';

// Config isolada dos testes. Não reaproveita vite.config.ts para não arrastar
// os plugins de build (react/tailwind) para dentro do runner.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // supabaseClient.ts explode no import se estas faltarem (ver src/lib/supabaseClient.ts).
    // Valores fake: nenhum teste bate na rede.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
  },
});
