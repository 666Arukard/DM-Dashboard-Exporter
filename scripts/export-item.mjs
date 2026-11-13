import { systemWarnings,assertEnvironment, MODULE_VERSION } from './export-character.mjs';
import { folderPath } from './export-monster.mjs';
import { embeddedItems } from './embedded-items.mjs';

const types = new Set(['weapon','equipment','consumable','tool','loot','container','spell','feat','class','subclass','race','background']);
const entries = collection => collection?.contents ?? [...(collection?.values?.() ?? [])];
const idOf = value => typeof value === 'string' ? value : value?.id ?? value?._id ?? null;
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
export function armorDetails(item) {
  const s=item.system ?? {},type=s.type?.value;
  if (item.type!=='equipment' || !['light','medium','heavy','natural','shield'].includes(type)) return null;
  const armor=s.armor ?? {},properties=s.properties instanceof Set || Array.isArray(s.properties) ? new Set(s.properties) : null;
  return {type,value:number(armor.value),base:number(armor.base),magicalBonus:typeof armor.magicalBonus==='string' ? armor.magicalBonus : number(armor.magicalBonus) === null ? null : String(armor.magicalBonus),dexLimit:number(armor.dex),dexUnlimited:armor.dex===null ? true : number(armor.dex) !== null ? false : null,strength:number(s.strength),stealthDisadvantage:properties ? properties.has('stealthDisadvantage') : null};
}
function getPack(game, id) {
  assertEnvironment(game);
  const pack = game.packs?.get(id);
  if (!pack || pack.documentName !== 'Item' || !pack.visible) throw Error('Bitte ein zugängliches Item-Compendium auswählen.');
  return pack;
}
export function itemPacks(game) {
  assertEnvironment(game);
  return entries(game.packs).filter(p=>p.documentName==='Item' && p.visible).map(p=>({id:p.collection,name:p.title ?? p.collection}));
}
export async function itemCatalog(game, packId) {
  const pack=getPack(game,packId),index=await pack.getIndex({fields:['type','folder']});
  getPack(game,packId);
  return entries(index).filter(i=>types.has(i.type)).map(i=>({id:i._id ?? i.id,name:i.name,type:i.type,folderId:idOf(i.folder),path:folderPath(pack,idOf(i.folder))})).sort((a,b)=>a.name.localeCompare(b.name,'de'));
}
export async function exportItem(game, packId, itemId, expectedFolderId, now=new Date()) {
  const pack=getPack(game,packId),worldId=game.world.id;
  if (typeof itemId!=='string' || !itemId) throw Error('Genau einen Eintrag ausdrücklich auswählen.');
  const item=await pack.getDocument(itemId);
  getPack(game,packId);
  if (game.world.id!==worldId || !item || item.id!==itemId || item.pack!==packId || !types.has(item.type) || item.parent) throw Error('Kein zulässiger Gegenstand, Zauber oder Charakteroption dieses Compendiums.');
  if (idOf(item.folder)!==expectedFolderId) throw Error('Eintrag wurde verschoben. Bitte erneut auswählen.');
  const warnings=systemWarnings(game);
  if (Number(game.release.build)!==368) warnings.push('Foundry-Build weicht vom Zielstand 14.368 ab. Werte vergleichen.');
  const data={kind:'item',schemaVersion:'1.0.0',exportedAt:now.toISOString(),source:{worldId,foundryVersion:String(game.version),foundryBuild:Number(game.release.build),systemId:game.system.id,systemVersion:game.system.version,exporterVersion:MODULE_VERSION,ddbImporterVersion:game.modules?.get('ddb-importer')?.version ?? null,packId,packName:pack.title ?? pack.metadata?.label ?? packId,folderPath:folderPath(pack,expectedFolderId)},item:embeddedItems(game,{items:[item]},warnings,{standalone:true})[0],warnings};
  data.schemaVersion=['feat','class','subclass','race','background'].includes(item.type)?'1.2.0':'1.1.0';
  data.item.itemDetails.armor=armorDetails(item);
  if (new TextEncoder().encode(JSON.stringify(data,null,2)).length>3*1024*1024) throw Error('Export überschreitet 3 MB. Es wird nichts abgeschnitten.');
  return data;
}

