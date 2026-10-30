import {defineConfig} from 'vite';
import path from 'node:path';
export default defineConfig({root:path.resolve('android-reader'),base:'./',build:{outDir:'build/web',emptyOutDir:true,target:'es2020',commonjsOptions:{include:[/node_modules/,/electron\/demo\.cjs/]}},server:{host:'127.0.0.1',port:5181,strictPort:true}});
