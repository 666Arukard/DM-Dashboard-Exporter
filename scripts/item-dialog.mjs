import {orderedExportButtons} from './dialog-buttons.mjs';
import {selectRememberedItem,selectRememberedItems} from './remembered-connection.mjs';
import { itemPacks, itemCatalog, exportItem } from './export-item.mjs';
import { assertEnvironment } from './export-character.mjs';
const optionLabels={feat:'Feat / Fähigkeit',class:'Klasse',subclass:'Unterklasse',race:'Spezies',background:'Hintergrund'};
const itemLabel=type=>optionLabels[type]??(type==='spell'?'Zauber':'Gegenstand');
const itemGroup=type=>optionLabels[type]?type:type==='spell'?'spell':'item';
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const {DialogV2}=foundry.applications.api;
export async function downloadItem(packId) {
  try {
    const catalog=await itemCatalog(game,packId);
    if (!catalog.length) throw Error('Keine unterstützten Gegenstände, Zauber oder Charakteroptionen in diesem Compendium.');
    const answer=await DialogV2.input({window:{title:'Gegenstand, Zauber oder Charakteroption auswählen'},content:`<p>Genau einen Eintrag wählen. Nur dieser wird gelesen. Keine Änderungen in Foundry.</p><label>Ausgabe<select name="output"><option value="network">Direktübertragung (gemerkte Kopplung)</option><option value="json">JSON-Datei herunterladen</option></select></label><label>Eintrag<select name="item" size="12" style="width:100%;height:300px"><option value="" selected>Bitte ausdrücklich auswählen</option>${catalog.map(i=>`<option value="${esc(i.id)}">${esc(i.name)} · ${itemLabel(i.type)} · ${esc(i.path.map(f=>f.name).join(' / ') || 'Ohne Ordner')}</option>`).join('')}</select></label>`,ok:{label:'Auswahl übernehmen'},rejectClose:false});
    if (!answer) return;
    const selected=catalog.find(i=>i.id===answer.item);
    if (!selected) throw Error('Bitte genau einen Eintrag auswählen.');
    if(answer.output==='network') { selectRememberedItem(game,packId,selected);ui.notifications.info('Auswahl zur Freigabe gesendet. Verbindungsstatus prüfen und im Testprogramm abrufen.');return; }
    const data=await exportItem(game,packId,selected.id,selected.folderId);
    if (!await DialogV2.confirm({window:{title:'Einzelexport prüfen'},content:`<p><strong>${esc(data.item.name)}</strong></p><p>${esc(data.source.packName)} · ${esc(data.item.type)}</p><p>Beschreibung und vorhandene Werte als JSON herunterladen. Anschließend im Windows-Testprogramm über „JSON-Datei auswählen“ übernehmen. Bilder und verlinkte Inhalte sind in diesem Schritt nicht enthalten.</p>${data.warnings.map(w=>`<p>${esc(w)}</p>`).join('')}`,yes:{label:'JSON herunterladen'},no:{label:'Abbrechen'},rejectClose:false})) return;
    assertEnvironment(game);
    if (!game.packs.get(packId)?.visible || game.world.id!==data.source.worldId) throw Error('Freigabe nicht mehr gültig. Bitte erneut auswählen.');
    foundry.utils.saveDataToFile(JSON.stringify(data,null,2),'application/json',`dnd-${optionLabels[data.item.type]?data.item.type:data.item.type === 'spell' ? 'spell' : 'item'}-${selected.id.replace(/[^a-zA-Z0-9_-]/g,'_')}.json`);
  } catch(error) { ui.notifications.error(error.message); }
}
export class ItemExportDialog extends DialogV2 {
  constructor(options={}) {
    let packs=[],error;
    try {packs=itemPacks(game);} catch(e) {error=e.message;}
    super(orderedExportButtons({...options,window:{title:'DM-Export – Gegenstände, Zauber & Charakteroptionen'},content:error?`<p>${esc(error)}</p>`:`<p>Einzelexport als JSON oder bis zu 50 Gegenstände, Zauber und Charakteroptionen per Netzwerk. Zunächst ein Compendium wählen.</p><label>Compendium<select name="pack"><option value="">Bitte auswählen</option>${packs.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label>`,buttons:[...(!error&&packs.length?[{action:'choose',label:'JSON-Export',callback:(_event,button)=>downloadItem(button.form.elements.pack.value)},{action:'network',label:'Direktübertragung',callback:(_event,button)=>connectItemSelection(button.form.elements.pack.value)}]:[]),{action:'cancel',label:'Schließen'}]}));
  }
}

export class ItemSelectionDialog extends DialogV2 {
  async _onRender(context, options_) {
    await super._onRender(context, options_);
    const root=this.element, rows=[...root.querySelectorAll('[data-item-row]')];
    const search=root.querySelector('input[name="itemSearch"]');
    const folder=root.querySelector('select[name="itemFolder"]');
    const type=root.querySelector('select[name="itemType"]');
    const boxes=rows.map(row=>row.querySelector('input'));
    const refresh=()=>{
      const query=search.value.trim().normalize('NFC').toLocaleLowerCase('de');
      for (const row of rows) row.style.display=(!type.value || row.dataset.type===type.value) && (!folder.value || row.dataset.folder===folder.value) && row.textContent.normalize('NFC').toLocaleLowerCase('de').includes(query)?'flex':'none';
      root.querySelector('[data-item-count]').textContent=boxes.filter(b=>b.checked).length+' / 50 ausgewählt · '+rows.filter(r=>r.style.display!=='none').length+' sichtbar';
    };
    type.onchange=refresh; search.oninput=refresh; folder.onchange=refresh;
    for (const box of boxes) box.onchange=()=>{
      if (boxes.filter(b=>b.checked).length>50) { box.checked=false; ui.notifications.error('Maximal 50 Einträge auswählen.'); }
      refresh();
    };
    root.querySelector('[data-item-select="all"]').onclick=()=>{
      try {
        assertEnvironment(game);
        const visible=rows.filter(r=>r.style.display!=='none').map(r=>r.querySelector('input'));
        if (new Set([...boxes.filter(b=>b.checked),...visible]).size>50) throw new Error('Maximal 50 Einträge. Suche weiter eingrenzen oder Auswahl reduzieren.');
        visible.forEach(b=>b.checked=true);refresh();
      } catch(error){ui.notifications.error(error.message);}
    };
    root.querySelector('[data-item-select="none"]').onclick=()=>{boxes.forEach(b=>b.checked=false);refresh();};
    refresh();
  }
}


export async function connectItemSelection(packId) {
 try {
  const catalog=await itemCatalog(game,packId);
  if(!catalog.length)throw Error('Keine unterstützten Gegenstände, Zauber oder Charakteroptionen.');
  const folders=[...new Map(catalog.map(e=>[e.folderId,{id:e.folderId??'__root__',name:e.path.map(f=>f.name).join(' → ')||'Ohne Ordner'}])).values()];
  new ItemSelectionDialog({window:{title:'Gegenstände, Zauber und Charakteroptionen auswählen'},content:`<p>1 bis 50 Einträge ausdrücklich freigeben. Filter behalten bereits markierte Einträge auch unsichtbar bei. Ordnerfilter zeigt direkt enthaltene Einträge. Zuerst die gemerkte Kopplung verbinden.</p>
  <label>Typ<select name="itemType"><option value="">Alle</option><option value="item">Gegenstände</option><option value="spell">Zauber</option>${Object.entries(optionLabels).map(([id,label])=>`<option value="${id}">${label}</option>`).join('')}</select></label>
  <label>Ordner<select name="itemFolder"><option value="">Alle Ordner</option>${folders.map(f=>`<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}</select></label>
  <label>Suche<input type="search" name="itemSearch" placeholder="Name …"></label>
  <button type="button" data-item-select="all">Alle sichtbaren auswählen</button><button type="button" data-item-select="none">Alle abwählen</button><p data-item-count role="status"></p>
  <div style="height:300px;min-height:200px;max-height:45vh;overflow-y:auto">${catalog.map(e=>`<label data-item-row data-folder="${esc(e.folderId??'__root__')}" data-type="${itemGroup(e.type)}" style="display:flex;gap:8px;padding:6px"><input type="checkbox" name="items" value="${esc(e.id)}"><span>${esc(e.name)}<small style="display:block">${esc(e.path.map(f=>f.name).join(' → ')||'Ohne Ordner')}</small></span></label>`).join('')}</div>`,buttons:[{action:'connect',label:'Direktübertragung',callback:(_event,button)=>{
   try {
    const ids=[...button.form.querySelectorAll('input[name="items"]:checked')].map(e=>e.value);
    if(!ids.length||ids.length>50||ids.some(id=>!catalog.some(e=>e.id===id)))throw Error('Bitte 1 bis 50 Einträge auswählen.');
    selectRememberedItems(game,packId,ids.map(id=>catalog.find(e=>e.id===id)));
    ui.notifications.info('Auswahl gesendet. Nach bestätigter Freigabe im Testprogramm abrufen.');
   }catch(e){ui.notifications.error(e.message);}
  }},{action:'cancel',label:'Schließen'}]}).render(true);
 }catch(e){ui.notifications.error(e.message);}
}

