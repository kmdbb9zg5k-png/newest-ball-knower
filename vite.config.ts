import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const root = path.resolve(__dirname, '.');

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        { find: '@', replacement: root },

        // Fix the flattened GitHub upload automatically
        {
          find: /^(?:\.\.\/|\.\/)(?:context|components|utils|data|services|lib)\/(.+)$/,
          replacement: `${root}/$1`,
        },

        {
          find: /^(?:\.\.\/|\.\/)types$/,
          replacement: `${root}/types`,
        },
      ],
    },

    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
