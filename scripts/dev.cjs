const { spawn } = require('node:child_process');
(async () => {
 const { createServer } = await import('vite');
 const server = await createServer({server:{host:'127.0.0.1',port:5173,strictPort:true}});
 await server.listen();
 const child = spawn(require('electron'), ['.'], {stdio:'inherit',env:{...process.env,LEAFLIGHT_DEV_URL:'http://127.0.0.1:5173'}});
 child.on('exit',async code=>{await server.close();process.exit(code??0)});
 process.on('SIGINT',()=>child.kill());
})();
