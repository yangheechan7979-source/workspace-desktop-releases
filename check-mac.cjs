const {_electron}=require('@playwright/test');
const fs=require('fs'),os=require('os'),path=require('path');
(async()=>{
 const app=await _electron.launch({executablePath:path.resolve(process.argv[2]),args:[`--user-data-dir=${fs.mkdtempSync(path.join(os.tmpdir(),'workspace-check-'))}`]});
 try{const p=await app.firstWindow();await p.waitForSelector('#authform');console.log('PASS macOS login screen on '+process.arch);}
 finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
