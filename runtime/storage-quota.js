((root)=>{
  const LIMIT_BYTES=30*1024*1024;
  const encoder=new TextEncoder();
  const jsonBytes=value=>encoder.encode(JSON.stringify(value)).length;
  function summarize(files,pdfTexts={}) {
    const usage={limitBytes:LIMIT_BYTES,usedBytes:0,pdfBytes:0,documentBytes:0,extractedTextBytes:0,trashBytes:0,sharedCount:0,fileCount:0,unknownPdfCount:0,byType:Object.create(null)};
    for(const file of files){
      const meta={...file};
      delete meta.data;delete meta.storageKey;
      if(file.type!=='words')delete meta.words;
      if(file.type!=='plan')delete meta.tasks;
      if(file.type!=='calendar')delete meta.events;
      if(!['note','idea'].includes(file.type))delete meta.body;
      let pdfBytes=0;
      if(file.type==='pdf'&&!file.sharedLink){
        if(typeof file.data==='string'&&file.data.startsWith('data:application/pdf;base64,')){
          const body=file.data.slice(file.data.indexOf(',')+1);
          pdfBytes=Math.max(0,Math.floor(body.length*3/4)-(body.endsWith('==')?2:body.endsWith('=')?1:0));
        }else if(Number.isSafeInteger(file.size)&&file.size>=0)pdfBytes=file.size;
        else if(file.hasPdfBody)usage.unknownPdfCount++;
      }
      const metadataBytes=jsonBytes(meta),textBytes=pdfTexts[file.id]?jsonBytes(pdfTexts[file.id]):0;
      const bytes=metadataBytes+pdfBytes+textBytes;
      usage.usedBytes+=bytes;usage.documentBytes+=metadataBytes;usage.pdfBytes+=pdfBytes;usage.extractedTextBytes+=textBytes;
      if(file.deleted)usage.trashBytes+=bytes;
      if(file.sharedLink)usage.sharedCount++;
      usage.fileCount++;
      const type=file.sharedLink?'shared':file.type||'other';
      const group=usage.byType[type] ||= {count:0,bytes:0};group.count++;group.bytes+=bytes;
    }
    usage.remainingBytes=Math.max(0,LIMIT_BYTES-usage.usedBytes);
    usage.percent=Math.min(100,usage.usedBytes/LIMIT_BYTES*100);
    return usage;
  }
  const api={LIMIT_BYTES,summarize,formatMB:bytes=>(bytes/1024/1024).toFixed(2)};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.storageQuota=api;
})(globalThis);
