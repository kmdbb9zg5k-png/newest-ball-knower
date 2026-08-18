import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';

function flattenedRepoResolver(root:string):Plugin{
  return {
    name:'ball-knower-flattened-repo-resolver',
    enforce:'pre',
    resolveId(source,importer){
      if(!importer || importer.includes('node_modules')) return null;
      const match=source.match(/^(?:\.\.\/|\.\/)(?:context|components|utils|data|services|lib)\/(.+)$/);
      if(match){
        const base=path.join(root,match[1]);
        for(const candidate of [base,`${base}.ts`,`${base}.tsx`,`${base}.js`,`${base}.jsx`]){
          if(fs.existsSync(candidate)) return candidate;
        }
      }
      if(/^(?:\.\.\/|\.\/)types$/.test(source)){
        for(const candidate of [path.join(root,'types.ts'),path.join(root,'types.tsx')]) if(fs.existsSync(candidate)) return candidate;
      }
      return null;
    },
  };
}

export default defineConfig(() => {
  const root = path.resolve(__dirname, '.');
  return {
    plugins: [flattenedRepoResolver(root), react(), tailwindcss()],
    resolve: { alias: { '@': root } },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
