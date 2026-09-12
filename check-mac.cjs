const {_electron}=require('@playwright/test');
const fs=require('fs'),os=require('os'),path=require('path');
(async()=>{
 let executable=path.resolve(process.argv[2]);
 if(fs.statSync(executable).isDirectory()) {
   const find=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(!e.isDirectory())continue;const p=path.join(dir,e.name);if(e.name.endsWith('.app'))return p;const result=find(p);if(result)return result;}};
   const bundle=find(executable);
   if(!bundle) throw new Error('No application bundle in release archive');
   const name=require('child_process').execFileSync('plutil',['-extract','CFBundleExecutable','raw','-o','-',path.join(bundle,'Contents/Info.plist')],{encoding:'utf8'}).trim();
   executable=path.join(bundle,'Contents/MacOS',name);
 }
 const app=await _electron.launch({executablePath:executable,args:[`--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(),'workspace-check-'))}`]});
 try{
   const p=await app.firstWindow();await p.waitForSelector('#authform');
   await p.evaluate(()=>{enter({id:'mini-check',email:'test@example.com',cloud:false});nav('clock');timerModes.clock='stopwatch';render();});
   const next=app.waitForEvent('window');await p.getByRole('button',{name:'작은 시계',exact:true}).click();const mini=await next;
   await mini.waitForSelector('[data-mini="toggle"]');await mini.locator('[data-mini="toggle"]').click();
   await p.waitForFunction(()=>stopwatches.clock.running);
   await mini.locator('[data-mini="lap"]').click();await p.waitForFunction(()=>stopwatches.clock.laps.length===1);
   await mini.locator('[data-mini="close"]').click();
   console.log('PASS macOS login and mini clock IPC on '+process.arch);
 }
 finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
