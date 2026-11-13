import {assertEnvironment} from './export-character.mjs';
import {exportMonster} from './export-monster.mjs';
export async function monsterJson(game,selection) {
 assertEnvironment(game);
 if(!Array.isArray(selection)||!selection.length||selection.length>50||new Set(selection.map(s=>s.id)).size!==selection.length)throw Error('Bitte 1 bis 50 unterschiedliche Monster auswählen.');
 const packId=selection[0].packId,worldId=game.world.id;
 if(selection.some(s=>s.packId!==packId))throw Error('Bitte Monster desselben Compendiums auswählen.');
 const exports=[],now=new Date();
 for(const entry of selection)exports.push(await exportMonster(game,packId,entry.id,entry.folderId,now,true));
 assertEnvironment(game);
 if(game.world.id!==worldId||!game.packs.get(packId)?.visible)throw Error('Welt oder Compendium inzwischen geändert.');
 const data=exports.length===1?exports[0]:{kind:'monsters',batchVersion:'1.1.0',exports};
 const text=JSON.stringify(data,null,2);
 if(new TextEncoder().encode(text).length>3*1024*1024)throw Error('Die gemeinsame JSON-Datei überschreitet 3 MB. Bitte weniger Monster auswählen oder den paketweisen Netzwerkabruf verwenden.');
 const filename=exports.length===1?`dnd-monster-${exports[0].monster.sourceId.replace(/[^a-zA-Z0-9_-]/g,'_')}.json`:`dnd-monsters-${exports.length}.json`;
 return {text,filename,exports,worldId,packId};
}
