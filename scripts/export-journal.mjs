import {journalInlineBlocks} from './journal-inline.mjs';
import {loadOfflineImage} from './images.mjs';
import {journalBlocks} from './journal-structure.mjs';
import {systemWarnings,assertEnvironment,MODULE_VERSION} from './export-character.mjs';
import {descriptionText} from './monster-statblock.mjs';
const entries=c=>c?.contents??(Array.isArray(c)?c:[...(c?.values?.()??[])]);
export function journalChoices(game){
 assertEnvironment(game);
 return entries(game.journal).filter(j=>!j.pack&&j.visible===true).map(j=>({id:j.id,name:j.name})).sort((a,b)=>a.name.localeCompare(b.name,'de'));
}
export function exportJournal(game,id,now=new Date(),{includeImages=false}={}){
 assertEnvironment(game);
 const journal=game.journal?.get(id);
 if(!id||!journal||journal.pack||journal.visible!==true)throw Error('Bitte genau ein zugängliches Welt-Journal auswählen.');
 const pages=[],skippedPages=[],warnings=systemWarnings(game);
 const ordered=[...entries(journal.pages)].sort((a,b)=>(a.sort??0)-(b.sort??0));
 for(const page of ordered){
  if(!page.id||typeof page.name!=='string')throw Error('Journal enthält eine ungültige Seite.');
  if(includeImages&&page.type==='image'){
   pages.push({sourceId:page.id,name:page.name,sort:Number.isFinite(page.sort)?page.sort:null,format:'image',title:{level:Number.isInteger(page.title?.level)&&page.title.level>=1&&page.title.level<=6?page.title.level:null,show:typeof page.title?.show==='boolean'?page.title.show:null},caption:descriptionText(page.image?.caption)??'',image:null});continue;
  }
  if(page.type!=='text'){skippedPages.push({sourceId:page.id,name:page.name,type:String(page.type??'unknown')});continue;}
  const html=page.text?.content,markdown=page.text?.markdown;
  const useMarkdown=typeof markdown==='string'&&markdown.trim()&&!(typeof html==='string'&&html.trim());
  const content=useMarkdown?markdown:descriptionText(html);
  if(content==null)warnings.push(`Seite „${page.name}“ enthält keinen verfügbaren Text.`);
  pages.push({sourceId:page.id,name:page.name,sort:Number.isFinite(page.sort)?page.sort:null,format:useMarkdown?'markdown':'text',content:content??'',title:{level:Number.isInteger(page.title?.level)&&page.title.level>=1&&page.title.level<=6?page.title.level:null,show:typeof page.title?.show==='boolean'?page.title.show:null},blocks:(includeImages?journalInlineBlocks:journalBlocks)(useMarkdown?markdown:html,!!useMarkdown)});
 }
 if(!pages.length)throw Error(includeImages?'Dieses Journal enthält keine Text- oder Bildseiten.':'Dieses Journal enthält keine Textseiten. Medienseiten werden noch nicht exportiert.');
 if(skippedPages.length)warnings.push(`${skippedPages.length} Nicht unterstützte Seite(n) ausgelassen; siehe skippedPages.`);
 warnings.push('Strukturierte Textausgabe mit Überschriften, ohne HTML-Layout oder Nachladen verlinkter Dokumente. PDF/Video und besondere Markdown-Bildsyntax sind nicht enthalten. Weitere Markdown-Formatierung bleibt Text.');
 const data={kind:'journal',schemaVersion:includeImages?'1.3.0':'1.1.0',exportedAt:now.toISOString(),source:{worldId:game.world.id,foundryVersion:String(game.version),foundryBuild:Number(game.release.build),systemId:game.system.id,systemVersion:game.system.version,exporterVersion:MODULE_VERSION,ddbImporterVersion:game.modules?.get('ddb-importer')?.version??null},journal:{sourceId:journal.id,name:journal.name,pages,skippedPages},warnings};
 if(new TextEncoder().encode(JSON.stringify(data,null,2)).length>3*1024*1024)throw Error('Journal überschreitet 3 MiB. Es wurde nichts abgeschnitten.');
 return data;
}

/** Nur Bildseiten des ausdrücklich freigegebenen Journals, einschließlich direkter Bilder innerhalb seiner Textseiten. */
export async function exportJournalWithImages(game,id,now=new Date(),{load=loadOfflineImage}={}){
 const data=exportJournal(game,id,now,{includeImages:true}),world=game.world.id,journal=game.journal.get(id);
 const cache=new Map(),signal=AbortSignal.timeout(20000);
 const check=()=>{assertEnvironment(game);if(game.world.id!==world||game.journal.get(id)!==journal||journal.visible!==true||journal.pack)throw Error('Journal-Freigabe nicht mehr gültig.');};
 for(const page of data.journal.pages){
  const original=entries(journal.pages).find(p=>p.id===page.sourceId);
  const snapshot=JSON.stringify({type:original?.type,src:original?.src,text:original?.text});
  const targets=page.format==='image'?[{target:page,src:original?.src}]:page.blocks.filter(b=>b.type==='image').map(target=>({target,src:target.src}));
  for(const {target,src} of targets){
   check();signal.throwIfAborted();
   if(typeof src!=='string'||!src.trim())throw Error(`Seite „${page.name}“ enthält keine Bildadresse.`);
   try{
    if(!cache.has(src))cache.set(src,await load(src,{signal,edges:[1024,768,512,256],maxBytes:512*1024}));
    target.image=cache.get(src);delete target.src;signal.throwIfAborted();check();
    if(!entries(journal.pages).includes(original)||JSON.stringify({type:original.type,src:original.src,text:original.text})!==snapshot)throw Error('Seite inzwischen geändert.');
    if(typeof target.image!=='string'||!target.image.startsWith('data:image/png;base64,'))throw Error('Keine PNG-Kopie.');
   }catch{throw Error(`Bild auf Seite „${page.name}“ konnte nicht übernommen werden. Bildzugriff, Format und Originalgröße (maximal 4 MB) prüfen. Das Journal wurde nicht gespeichert.`);}
   if(new TextEncoder().encode(JSON.stringify(data,null,2)).length>3*1024*1024)throw Error('Journal überschreitet mit Bildern 3 MiB. Es wurde nichts abgeschnitten.');
  }
 }
 check();return data;
}
