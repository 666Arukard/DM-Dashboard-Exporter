import {descriptionText} from './monster-statblock.mjs';
import {journalBlocks} from './journal-structure.mjs';
const cleanText=value=>descriptionText(value)??'';
function imageReference(tag){
 const attributes=new Map();
 for(const match of tag.replace(/^<img\b/i,'').matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)){
  const name=match[1].toLowerCase();if(!attributes.has(name))attributes.set(name,match[2]??match[3]??match[4]??'');
 }
 const src=cleanText(attributes.get('src'));if(!src)throw Error('Eingebettetes Bild hat keine unterstützte src-Adresse.');
 return {type:'image',src,caption:cleanText(attributes.get('alt')),image:null};
}
/** Safe text/image references only. No HTML nodes, attributes or scripts reach the archive. */
export function journalInlineBlocks(value,markdown=false){
 if(typeof value!=='string'||!value.trim())return [];
 if(markdown)return markdownImages(journalBlocks(value,true));
 const clean=value.replace(/<!--[\s\S]*?(?:-->|$)/g,'').replace(/<(script|style|iframe|template|svg)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,'');
 const tokens=/<\/?h([1-6])\b[^>]*>|<img\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
 const blocks=[];let cursor=0,level=null;
 const add=value=>{const text=cleanText(value);if(text)blocks.push(level?{type:'heading',level,text}:{type:'text',text});};
 for(const match of clean.matchAll(tokens)){
  add(clean.slice(cursor,match.index));
  if(/^<img\b/i.test(match[0]))blocks.push(imageReference(match[0]));
  else level=match[0].startsWith('</')?null:Number(match[1]);
  cursor=match.index+match[0].length;
 }
 add(clean.slice(cursor));return blocks;
}
function markdownImages(blocks){
 const result=[];let fence=null;
 for(const block of blocks){
  let pending=[];
  const flush=()=>{if(pending.length){const text=pending.join('\n').trim();if(text)result.push({...block,text});pending=[];}};
  for(const line of block.text.split('\n')){
   const marker=/^ {0,3}(`{3,}|~{3,})/.exec(line);
   if(marker){if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length)fence=null;pending.push(line);continue;}
   if(fence||/^ {4}|^\t/.test(line)){pending.push(line);continue;}
   // Common inline Markdown images; code spans are deliberately left as text.
   const pattern=/(`+)[\s\S]*?\1|(?<!\\)!\[([^\]\n]*)\]\(\s*(?:<([^>\n]+)>|([^\s()]+))(?:\s+"[^"\n]*")?\s*\)/g;
   let cursor=0;
   for(const match of line.matchAll(pattern)){
    if(match[1])continue;
    pending.push(line.slice(cursor,match.index));flush();
    result.push({type:'image',src:match[3]??match[4],caption:match[2],image:null});cursor=match.index+match[0].length;
   }
   pending.push(line.slice(cursor));
  }
  flush();
 }
 return result;
}
