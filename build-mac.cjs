const path=require('path');
const {execFileSync}=require('child_process');
(async()=>{
 const fs=require('fs');fs.mkdirSync('Workspace.iconset',{recursive:true});
 for(const size of [16,32,128,256,512]) for(const scale of [1,2]) execFileSync('sips',['-z',String(size*scale),String(size*scale),'runtime/app.png','--out',`Workspace.iconset/icon_${size}x${size}${scale===2?'@2x':''}.png`]);
 execFileSync('iconutil',['-c','icns','Workspace.iconset']);
 const {packager}=await import('@electron/packager');
 const [app]=await packager({dir:'runtime',name:'Workspace',platform:'darwin',arch:'universal',electronVersion:'38.8.6',out:'out',overwrite:true,prune:false,asar:true,appBundleId:'com.workspace.desktop',icon:path.resolve('Workspace.icns')});
 const bundle=path.join(app,'Workspace.app');
 execFileSync('codesign',['--force','--deep','--sign','-',bundle],{stdio:'inherit'});
 execFileSync('codesign',['--verify','--deep','--strict',bundle],{stdio:'inherit'});
 const {build,Platform,Arch}=require('electron-builder');
 await build({prepackaged:app,targets:Platform.MAC.createTarget(['dmg','zip'],Arch.universal),publish:'never',config:{appId:'com.workspace.desktop',productName:'Workspace',directories:{app:'runtime',output:'dist'},mac:{identity:null,artifactName:'Workspace-Mac.${ext}'},dmg:{sign:false}}});
})();
