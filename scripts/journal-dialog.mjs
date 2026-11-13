import {selectRememberedJournals} from './remembered-connection.mjs';
import {assertEnvironment} from './export-character.mjs';
import {journalChoices,exportJournalWithImages} from './export-journal.mjs';
const selectedIds=form=>[...form.querySelectorAll('input[name="journals"]:checked')].map(box=>box.value);
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class JournalExportDialog extends foundry.applications.api.DialogV2 {
 constructor(options={}){
  let journals=[],error;try{journals=journalChoices(game);}catch(e){error=e.message;}
  super({...options,position:{width:640},window:{title:'Welt-Journals exportieren'},content:error?`<p>${esc(error)}</p>`:`<p>1–50 Welt-Journals mit Text- und Bildseiten für die Direktübertragung auswählen. Zuerst die gemerkte Kopplung über „Verbinden“ öffnen. JSON-Export unterstützt weiterhin genau ein Journal. Bildseiten und direkt eingefügte Textbilder werden als Offline-Kopien übernommen. PDF, Video und verlinkte Dokumente werden ausgelassen.</p><label>Suche<input type="search" name="journalSearch"></label><p><button type="button" data-journal-select="all">Alle sichtbaren auswählen</button> <button type="button" data-journal-select="none">Alle abwählen</button></p><p data-journal-count></p><div style="height:300px;max-height:45vh;overflow:auto">${journals.map(j=>`<label data-journal-row style="display:flex;gap:8px;overflow-wrap:anywhere"><input type="checkbox" name="journals" value="${esc(j.id)}">${esc(j.name)}</label>`).join('')}</div>`,buttons:[...(!error?[{action:'direct',label:'Direktübertragung',callback:(_event,button)=>{try{selectRememberedJournals(game,selectedIds(button.form));}catch(e){ui.notifications.error(e.message);}}},{action:'export',label:'JSON-Export',callback:async(_event,button)=>{
   try{
    const ids=selectedIds(button.form);if(ids.length!==1)throw Error('Für den JSON-Export bitte genau ein Journal auswählen.');
    const id=ids[0],data=await exportJournalWithImages(game,id);
    const confirmed=await foundry.applications.api.DialogV2.confirm({window:{title:'Journalexport prüfen'},content:`<p>${esc(data.journal.name)}: ${data.journal.pages.length} Text-/Bildseiten.</p>${data.warnings.map(w=>`<p>${esc(w)}</p>`).join('')}`,yes:{label:'JSON herunterladen'},no:{label:'Abbrechen'},rejectClose:false});
    if(!confirmed)return;
    assertEnvironment(game);if(game.world.id!==data.source.worldId||!journalChoices(game).some(j=>j.id===id))throw Error('Journal-Freigabe nicht mehr gültig.');
    foundry.utils.saveDataToFile(JSON.stringify(data,null,2),'application/json',`dnd-journal-${id.replace(/[^a-zA-Z0-9_-]/g,'_')}.json`);
   }catch(e){ui.notifications.error(e.message);}
  }}]:[]),{action:'cancel',label:'Schließen'}]});
 }

 async _onRender(context,options){
  await super._onRender(context,options);
  const root=this.element,search=root.querySelector('[name="journalSearch"]');if(!search)return;
  const rows=[...root.querySelectorAll('[data-journal-row]')],boxes=rows.map(row=>row.querySelector('input'));
  const refresh=()=>{
   const query=search.value.trim().normalize('NFC').toLocaleLowerCase('de');
   for(const row of rows)row.style.display=row.textContent.normalize('NFC').toLocaleLowerCase('de').includes(query)?'flex':'none';
   root.querySelector('[data-journal-count]').textContent=boxes.filter(b=>b.checked).length+' / 50 ausgewählt · '+rows.filter(r=>r.style.display!=='none').length+' sichtbar';
  };
  search.oninput=refresh;
  for(const box of boxes)box.onchange=()=>{if(boxes.filter(b=>b.checked).length>50){box.checked=false;ui.notifications.error('Maximal 50 Journals auswählen.');}refresh();};
  root.querySelector('[data-journal-select="all"]').onclick=()=>{
   try{
    assertEnvironment(game);
    const visible=rows.filter(r=>r.style.display!=='none').map(r=>r.querySelector('input'));
    if(new Set([...boxes.filter(b=>b.checked),...visible]).size>50)throw Error('Maximal 50 Journals auswählen. Bitte die Suche eingrenzen.');
    visible.forEach(b=>b.checked=true);refresh();
   }catch(e){ui.notifications.error(e.message);}
  };
  root.querySelector('[data-journal-select="none"]').onclick=()=>{boxes.forEach(b=>b.checked=false);refresh();};
  refresh();
 }
}
