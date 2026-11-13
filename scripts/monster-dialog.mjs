import {orderedExportButtons} from './dialog-buttons.mjs';
import {monsterJson} from './monster-json.mjs';
import {selectRememberedMonsters} from './remembered-connection.mjs';
import { assertEnvironment } from './export-character.mjs';
import { monsterPacks, monsterCatalog } from './export-monster.mjs';
import { connectMonster, replaceConnection } from './network.mjs';

const { DialogV2 } = foundry.applications.api;
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const options = values => values.map(value => `<option value="${escape(value.id)}">${escape(value.name)}</option>`).join('');


export class MonsterSelectionDialog extends DialogV2 {
  async _onRender(context, options_) {
    await super._onRender(context, options_);
    const root=this.element, rows=[...root.querySelectorAll('[data-monster-row]')];
    const search=root.querySelector('input[name="monsterSearch"]');
    const folder=root.querySelector('select[name="monsterFolder"]');
    const boxes=rows.map(row=>row.querySelector('input'));
    const refresh=()=>{
      const query=search.value.trim().normalize('NFC').toLocaleLowerCase('de');
      for (const row of rows) row.style.display=(!folder.value || row.dataset.folder===folder.value) && row.textContent.normalize('NFC').toLocaleLowerCase('de').includes(query)?'flex':'none';
      root.querySelector('[data-monster-count]').textContent=boxes.filter(b=>b.checked).length+' / 50 ausgewählt · '+rows.filter(r=>r.style.display!=='none').length+' sichtbar';
    };
    search.oninput=refresh; folder.onchange=refresh;
    for (const box of boxes) box.onchange=()=>{
      if (boxes.filter(b=>b.checked).length>50) { box.checked=false; ui.notifications.error('Maximal 50 Monster auswählen.'); }
      refresh();
    };
    root.querySelector('[data-monster-select="all"]').onclick=()=>{
      try {
        assertEnvironment(game);
        const visible=rows.filter(r=>r.style.display!=='none').map(r=>r.querySelector('input'));
        if (new Set([...boxes.filter(b=>b.checked),...visible]).size>50) throw new Error('Maximal 50 Monster. Suche weiter eingrenzen oder Auswahl reduzieren.');
        visible.forEach(b=>b.checked=true);refresh();
      } catch(error){ui.notifications.error(error.message);}
    };
    root.querySelector('[data-monster-select="none"]').onclick=()=>{boxes.forEach(b=>b.checked=false);refresh();};
    refresh();
  }
}

export async function connectMonsterSelection(packId, jsonDownload = false) {
  try {
    const catalog = await monsterCatalog(game, packId);
    if (!catalog.length) throw new Error('Dieses Compendium enthält keine NPC-Monster im Index.');
    const folders = [...new Map(catalog.map(entry => [entry.folderId, { id: entry.folderId ?? '__root__', name: entry.path.map(p => p.name).join(' → ') || '(Ohne Ordner)' }])).values()];
    const candidates = catalog;
    // Popup direkt im Klick-Callback öffnen; vorher alle asynchronen Auswahlschritte abschließen.
    new MonsterSelectionDialog({ position: {width:680}, window: { title: jsonDownload ? 'Monster als JSON herunterladen' : 'Monster – Direktübertragung' },
      content: `${jsonDownload ? '<p>JSON-Download: Die gemeinsame Datei darf maximal 3 MB groß sein.</p>' : ''}<p>1 bis 50 Monster aus diesem Compendium über mehrere Ordner hinweg ausdrücklich für wiederholte Abrufe freigeben. Checkboxen markieren; ohne Markierung wird nichts freigegeben. Suche und Ordnerfilter blenden Einträge aus, behalten aber deren Auswahl. Ordnerfilter zeigen nur direkt enthaltene Monster; „Alle Ordner“ zeigt den gesamten Index. ${jsonDownload ? '' : 'Bei gemerkter Verbindung das Linkfeld leer lassen; ein Auswahlwechsel benötigt dann keinen neuen Link. Foundry und das Verbindungsfenster geöffnet lassen.'}</p><label>Ordnerfilter<select name="monsterFolder"><option value="">Alle Ordner</option>${options(folders)}</select></label><label>Monster suchen<input name="monsterSearch" type="search" placeholder="Name …"></label><div style="display:flex;gap:8px"><button type="button" data-monster-select="all">Alle sichtbaren auswählen</button><button type="button" data-monster-select="none">Alle abwählen</button></div><p data-monster-count role="status"></p><div style="height:280px;min-height:200px;max-height:40vh;overflow-y:auto;flex:none;border:1px solid currentColor;padding:8px" aria-label="Monsterauswahl">${candidates.map(entry=>`<label data-monster-row data-folder="${escape(entry.folderId ?? '__root__')}" style="display:flex;align-items:center;gap:8px;padding:6px"><input type="checkbox" name="monsters" value="${escape(entry.id)}"><span>${escape(entry.name)}<small style="display:block">${escape(entry.path.map(p=>p.name).join(' → ') || '(Ohne Ordner)')} · ${escape(entry.id)}</small></span></label>`).join('')}</div>${jsonDownload ? '' : '<label>Verbindungslink (bei gemerkter Verbindung leer lassen)</label><input name="link" type="text" autocomplete="off">'}`,
      buttons: [{ action: 'connect', label: jsonDownload ? 'JSON-Export' : 'Direktübertragung', callback: (_event, button) => {
        try {
          const ids = [...button.form.querySelectorAll('input[name="monsters"]:checked')].map(o=>o.value);
          if (!ids.length || ids.length > 50 || ids.some(id=>!candidates.some(e=>e.id===id))) throw new Error('Bitte 1 bis 50 Monster aus diesem Compendium auswählen.');
          const selection = ids.map(id=>({ id, name:candidates.find(e=>e.id===id).name, packId, folderId:candidates.find(e=>e.id===id).folderId }));
          if (jsonDownload) return downloadMonsterSelection(selection);
          if (!button.form.elements.link.value.trim()) {selectRememberedMonsters(game,selection);return;}
          replaceConnection(connectMonster(game, selection, button.form.elements.link.value, window, message => ui.notifications.error(message)));
          ui.notifications.info('Monsterverbindung geöffnet. Den Abruf im Testprogramm starten.');
        } catch (error) { ui.notifications.error(error.message); }
      } }, { action: 'cancel', label: 'Schließen' }]
    }).render(true);
  } catch (error) { ui.notifications.error(error.message || 'Monsterverbindung fehlgeschlagen.'); }
}

export async function downloadMonster(packId) { return connectMonsterSelection(packId,true); }
export async function downloadMonsterSelection(selection) {
 try {
  const result=await monsterJson(game,selection);
  const content='<p>'+result.exports.length+' Monster mit Statblock, Fähigkeiten und vorhandenen Offline-Bildern. Foundry bleibt unverändert.</p><ul>'+result.exports.map(d=>'<li>'+escape(d.monster.name)+' · CR '+escape(d.monster.challengeRating ?? 'unbekannt')+' · '+escape(d.source.folderPath.map(f=>f.name).join(' → ') || '(Ohne Ordner)')+d.warnings.map(w=>'<p>'+escape(w)+'</p>').join('')+'</li>').join('')+'</ul>';
  if(!await DialogV2.confirm({position:{width:680},window:{title:'Monsterexport prüfen'},content:'<div data-monster-preview>'+content+'</div>',yes:{label:'JSON herunterladen'},no:{label:'Abbrechen'},rejectClose:false}))return;
  assertEnvironment(game);
  if(game.world.id!==result.worldId||!game.packs.get(result.packId)?.visible)throw Error('Welt oder Compendium inzwischen geändert.');
  foundry.utils.saveDataToFile(result.text,'application/json',result.filename);
  ui.notifications.info('Monsterexport an den Browser übergeben. Die gemeinsame JSON-Datei im Testprogramm importieren.');
 }catch(error){ui.notifications.error(error.message || 'Monsterexport fehlgeschlagen.');}
}

export class MonsterExportDialog extends DialogV2 {
  constructor(options_ = {}) {
    let packs = [], error;
    try { packs = monsterPacks(game); } catch (e) { error = e.message; }
    super(orderedExportButtons({ ...options_, position:{width:680}, window: { title: 'D&D DM-Dashboard – Monsterexport' },
      content: error ? `<p>${escape(error)}</p>` : `<p>Per JSON oder Netzwerk 1 bis 50 ausgewählte Monster über mehrere Ordner hinweg lesen. Zunächst das Compendium wählen.</p><label data-monster-export>Compendium</label><select name="pack" required><option value="">Bitte auswählen</option>${options(packs.map(p => ({ ...p, name: `${p.name} [${p.id}]` })))}</select>`,
      buttons: [...(!error && packs.length ? [{ action: 'select', label: 'JSON-Export', default: true, callback: (_event, button) => downloadMonster(button.form.elements.pack.value) },
        { action: 'connect', label: 'Direktübertragung', callback: (_event, button) => connectMonsterSelection(button.form.elements.pack.value) }] : []), { action: 'cancel', label: 'Schließen' }]
    }));
  }
}


