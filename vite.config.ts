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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalized=id.replace(/\\/g,'/');
            if(normalized.includes('/node_modules/react/')||normalized.includes('/node_modules/react-dom/')||normalized.includes('/node_modules/scheduler/'))return 'vendor-react';
            if(normalized.includes('/node_modules/@supabase/'))return 'vendor-supabase';
            if(normalized.includes('/node_modules/lucide-react/')||normalized.includes('/node_modules/motion/'))return 'vendor-ui';
            if(/\/afc(?:East|North|South|West)\.ts$/.test(normalized))return 'player-catalog-afc';
            if(/\/nfc(?:East|North|South|West)\.ts$/.test(normalized))return 'player-catalog-nfc';
            if(/\/madden27(?:CurrentRoster|RosterChunk\d+)\.ts$/.test(normalized))return 'madden-roster';
            if(normalized.endsWith('/maddenRatings.ts'))return 'madden-ratings';
            if(/\/(?:players|masterRoster2026|currentSeasonRoster)\.ts$/.test(normalized))return 'player-catalog-core';
            if(/\/(?:simulation|soloSeasonEngine|soloFranchiseEngine|fantasyLiveScoring)\.ts$/.test(normalized))return 'simulation-engines';
          },
        },
      },
    },
  };
});
