// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  integrations: [
    react(),
  ],
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  server: {
    host: true, // Permite acceso desde la red local (0.0.0.0)
    port: 4321,
  },
  vite: {
    ssr: {
      noExternal: ['@supabase/supabase-js'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react/jsx-runtime'],
      force: true,
    },
    server: {
      host: true, // También expone Vite HMR a la red
    },
  },
});
