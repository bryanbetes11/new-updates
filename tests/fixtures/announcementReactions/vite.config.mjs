import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)), repo=path.resolve(root,'../../..');
export default defineConfig({root,plugins:[{name:'isolated-announcement-reactions',enforce:'pre',resolveId(source){
  if(/\/supabase(?:\.ts)?$/.test(source))return path.join(root,'mock.ts');
  if(/\/(AuthContext|ToastContext)(?:\.tsx)?$/.test(source))return path.join(root,'context.ts');
}},react()],server:{host:'127.0.0.1',port:5179,strictPort:true,fs:{allow:[repo]}},css:{postcss:path.join(repo,'postcss.config.js')}});
