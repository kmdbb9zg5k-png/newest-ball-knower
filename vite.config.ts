import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { defineConfig, Plugin } from 'vite';

function flattenedRepoResolver(root:string):Plugin{
  const resolveFlat=(value:string)=>{
    const full=path.join(root,value);
    const leaf=path.join(root,path.basename(value));
    for(const base of [full,leaf]){
      for(const candidate of [base,`${base}.ts`,`${base}.tsx`,`${base}.js`,`${base}.jsx`]){
        if(fs.existsSync(candidate)) return candidate;
      }
    }
    return null;
  };
  return {
    name:'ball-knower-flattened-repo-resolver',
    enforce:'pre',
    resolveId(source,importer){
      if(!importer || importer.includes('node_modules')) return null;
      const match=source.match(/^(?:\.\.\/|\.\/)(?:context|components|utils|data|services|lib)\/(.+)$/);
      if(match) return resolveFlat(match[1]);
      if(/^(?:\.\.\/|\.\/)types$/.test(source)) return resolveFlat('types');
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
