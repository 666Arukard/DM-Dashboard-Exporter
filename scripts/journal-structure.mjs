import {descriptionText} from './monster-statblock.mjs';
// Export only text and heading levels, never executable markup or attributes.
export function journalBlocks(value,markdown=false){
 if(typeof value!=='string'||!value.trim())return [];
 const blocks=[];
 const add=text=>{const content=markdown?text.trim():descriptionText(text);if(content)blocks.push({type:'text',text:content});};
 if(markdown){
  const lines=value.split(/\r?\n/);let pending=[],fence=null;
  const flush=()=>{add(pending.join('\n'));pending=[];};
  for(let i=0;i<lines.length;i++){
   const line=lines[i],marker=/^ {0,3}(`{3,}|~{3,})/.exec(line);
   if(marker){if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length)fence=null;pending.push(line);continue;}
   if(fence){pending.push(line);continue;}
   const heading=/^ {0,3}(#{1,6})(?:\s+|$)(.*)$/.exec(line);
   const underline=line.trim()&&/^ {0,3}(=+|-+)\s*$/.exec(lines[i+1]??'');
   if(heading||underline){flush();blocks.push({type:'heading',level:heading?heading[1].length:underline[1][0]==='='?1:2,text:heading?heading[2].replace(/\s+#+\s*$/,'').trim():line.trim()});if(underline)i++;}
   else pending.push(line);
  }
  flush();return blocks;
 }
 const clean=value.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style|iframe|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 const pattern=/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1\s*>/gi;
 let cursor=0;
 for(const match of clean.matchAll(pattern)){add(clean.slice(cursor,match.index));blocks.push({type:'heading',level:Number(match[1]),text:descriptionText(match[2])??''});cursor=match.index+match[0].length;}
 add(clean.slice(cursor));return blocks;
}
