import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // Separa libs de vendor em chunks estáveis: mudanças no código da app
          // não invalidam o cache do react/supabase/recharts no navegador.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return;
            if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory-vendor')) return 'charts';
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
