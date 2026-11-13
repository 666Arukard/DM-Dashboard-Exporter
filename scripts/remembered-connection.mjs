import {journalChoices,exportJournalWithImages} from './export-journal.mjs';
import {itemPacks,exportItem} from './export-item.mjs';
import {assertEnvironment,getCharacter,selectedCharacters,exportCharacterWithImages} from './export-character.mjs';
import {monsterPacks,exportMonster} from './export-monster.mjs';

let active;
const hex=v=>typeof v==='string' && /^[a-f0-9]{64}$/.test(v);
const changed=()=>globalThis.document?.dispatchEvent(new Event('dnd-dm-connection-change'));
function binding(game,host) {
  assertEnvironment(game);
  if(!game.user.id || !game.world.id)throw Error('Spielleiter- oder Weltkennung fehlt.');
  return {foundryOrigin:host.location.origin,worldId:game.world.id,userId:game.user.id};
}
const storageKey=c=>'dnd-dm-pairing/1/'+JSON.stringify([c.foundryOrigin,c.worldId,c.userId]);
function saved(game,host) {
  const c=binding(game,host),raw=host.localStorage.getItem(storageKey(c));
  if(!raw)return null;
  let value;try{value=JSON.parse(raw);}catch{throw Error('Gemerkte Kopplung beschädigt. Im Testprogramm aufheben und neu koppeln.');}
  const u=new URL(value.localOrigin);
  if(value.version!==1||!hex(value.id)||!hex(value.installationId)||u.origin!==value.localOrigin||u.protocol!=='http:'||u.hostname!=='127.0.0.1')throw Error('Ungültige gemerkte Kopplung.');
  return value;
}
export function rememberedSummary(game,host=globalThis.window) {
  if(active && !active.popup.closed) {
    if(active.connected && Date.now()-active.lastSeen>15000)return 'Verbindung unterbrochen – Status wird geprüft.';
    return active.status;
  }
  try{return saved(game,host)?'Kopplung gemerkt – getrennt. „Verbinden“ öffnet das Verbindungsfenster.':null;}catch(e){return e.message;}
}
export function disconnectRemembered() {if(active){active.send({type:'stop'});active.connected=false;active.status='Verbindung getrennt.';active.approved=null;changed();}}
export function forgetRemembered() {
  if(!active?.connected || active.popup.closed)throw Error('Zum Aufheben zuerst verbinden oder im Testprogramm die Kopplung aufheben.');
  active.send({type:'forget'});
}
export function openRemembered(game,link='',host=window,notify=message=>globalThis.ui?.notifications.error(message)) {
  const c=binding(game,host),key=storageKey(c);
  let identity,token,origin;
  if(link.trim()) {
    const url=new URL(link.trim());
    if(url.protocol!=='http:'||url.hostname!=='127.0.0.1'||url.pathname!=='/bridge'||url.search||url.username||url.password||!/^#[a-f0-9]{64}$/.test(url.hash))throw Error('Bitte den Einmallink aus dem Testprogramm einfügen.');
    origin=url.origin;token=url.hash.slice(1);
  } else {identity=saved(game,host);if(!identity)throw Error('Zuerst „Kopplung merken“ verwenden.');origin=identity.localOrigin;}
  if(active&&!active.popup.closed){if(active.connected)throw Error('Verbindung bereits geöffnet. Erst trennen und Fenster schließen.');active.close();}
  const random=new Uint8Array(32);host.crypto.getRandomValues(random);const channel=Array.from(random,b=>b.toString(16).padStart(2,'0')).join('');
  const popup=host.open(origin+'/remember#'+channel,'_blank','popup,width=580,height=560');
  if(!popup)throw Error('Verbindungsfenster blockiert. Bitte per Klick erneut öffnen.');
  let closed=false,initialized=false;const started=Date.now();
  const send=data=>{if(!closed&&!popup.closed)popup.postMessage({protocol:'dnd-dm-remember/1',channel,...data},origin);};
  const state={popup,send,connected:false,status:'Verbindungsaufbau …',lastSeen:Date.now(),approved:null,revision:0,close:()=>{closed=true;clearInterval(timer);host.removeEventListener('message',receive);popup.close();}};
  const processed=new Set(),times=new Map();
  const check=()=>{const now=binding(game,host);if(JSON.stringify(c)!==JSON.stringify(now))throw Error('Welt oder Spielleiter gewechselt. Verbindung getrennt.');};
  const receive=async event=>{
    if(closed||event.source!==popup||event.origin!==origin||event.data?.protocol!=='dnd-dm-remember/1'||event.data.channel!==channel)return;
    const m=event.data;
    try {
      check();state.lastSeen=Date.now();
      if(m.type==='remembered') {
        if(!hex(m.identity?.id)||!hex(m.identity?.installationId))throw Error('Ungültige Kopplungsantwort.');
        identity={version:1,localOrigin:origin,...m.identity};host.localStorage.setItem(key,JSON.stringify(identity));token=null;
      }
      if(m.type==='connected'){initialized=true;state.connected=true;state.approved=null;state.revision=0;processed.clear();times.clear();}
      if(m.type==='status')state.status=String(m.text).slice(0,500);
      if(m.type==='ping')send({type:'pong'});
      if(m.type==='selected'){state.approved=m.selection;state.revision=m.revision;processed.clear();times.clear();}
      if(m.type==='selection-error')notify(m.text);
      if(m.type==='disconnected'){initialized=true;state.connected=false;state.approved=null;}
      if(m.type==='forgotten'){host.localStorage.removeItem(key);state.connected=false;state.approved=null;}
      if(m.type==='export-part') {
        if(!state.connected || !state.approved || m.revision!==state.revision || !hex(m.requestId))return;
        const choices=Array.isArray(state.approved)?state.approved:['item','journal'].includes(state.approved.kind)?[state.approved]:state.approved.kind==='items'?state.approved.items:state.approved.kind==='journals'?state.approved.journals:state.approved.monsters;
        if(!Number.isInteger(m.index)||m.index<0||m.index>=choices.length)throw Error('Ungültiger Paketindex.');
        const requestKey=m.requestId+':'+m.index;if(processed.has(requestKey))return;processed.add(requestKey);if(processed.size>100)processed.delete(processed.values().next().value);
        if(!times.has(m.requestId)){times.set(m.requestId,new Date());if(times.size>100)times.delete(times.keys().next().value);}
        const selected=choices[m.index],revision=state.revision;
        const data=selected.kind==='journal'?await exportJournalWithImages(game,selected.id,times.get(m.requestId)):selected.kind==='item'?await exportItem(game,selected.packId,selected.id,selected.folderId,times.get(m.requestId)):selected.kind==='monster'?await exportMonster(game,selected.packId,selected.id,selected.folderId,times.get(m.requestId),true):await exportCharacterWithImages(game,selected.id,null,times.get(m.requestId));
        check();if(!state.connected||state.revision!==revision)return;
        const text=JSON.stringify(data);if(new TextEncoder().encode(text).length>3*1024*1024)throw Error('Eintrag überschreitet 3 MB.');
        send({type:'part',requestId:m.requestId,index:m.index,revision,text});
      }
      changed();
    }catch(e){notify(e.message);if(m.type==='export-part')send({type:'export-error',requestId:m.requestId});else{send({type:'stop'});state.connected=false;state.approved=null;state.status=e.message;changed();}}
  };
  host.addEventListener('message',receive);
  const timer=setInterval(()=>{
    if(popup.closed){closed=true;clearInterval(timer);host.removeEventListener('message',receive);state.connected=false;changed();return;}
    try{check();if(!initialized){if(Date.now()-started>20000)throw Error('Keine Antwort vom Verbindungsfenster. Testprogramm starten und Popup prüfen; anschließend erneut verbinden.');send({type:'init',context:c,token,identity});}}catch(e){send({type:'stop'});state.connected=false;state.status=e.message;initialized=true;changed();}
  },500);timer.unref?.();
  active=state;changed();return state;
}
export function selectRememberedCharacters(game,ids) {
  const actors=selectedCharacters(game,ids).map(id=>({id,name:getCharacter(game,id).name,worldId:game.world.id}));
  select(actors,'character-parts/1');
}
export function selectRememberedMonsters(game,selection) {
  assertEnvironment(game);
  if(!Array.isArray(selection)||selection.length<1||selection.length>50||new Set(selection.map(s=>s.id)).size!==selection.length||selection.some(s=>s.packId!==selection[0].packId)||!monsterPacks(game).some(p=>p.id===selection[0].packId))throw Error('Ungültige Monsterauswahl.');
  select({kind:'monsters',monsters:selection.map(s=>({...s,kind:'monster',worldId:game.world.id}))},'monster-parts/1');
}
function select(selection,transfer){if(!active?.connected||active.popup.closed)throw Error('Zuerst die gemerkte Kopplung über „Verbinden“ öffnen.');active.send({type:'select',selection,transfer});}

export function selectRememberedItem(game,packId,selected) {
  assertEnvironment(game);
  if(!itemPacks(game).some(p=>p.id===packId))throw Error('Ungültiges Item-Compendium.');
  select({kind:'item',packId,id:selected.id,name:selected.name,folderId:selected.folderId,itemType:selected.type,worldId:game.world.id},'item-parts/1');
}

export function selectRememberedItems(game,packId,entries) {
  assertEnvironment(game);
  if(!itemPacks(game).some(p=>p.id===packId) || !Array.isArray(entries) || !entries.length || entries.length>50 || new Set(entries.map(e=>e.id)).size!==entries.length)throw Error('Bitte 1 bis 50 Einträge desselben Compendiums auswählen.');
  select({kind:'items',items:entries.map(e=>({kind:'item',packId,id:e.id,name:e.name,folderId:e.folderId,itemType:e.type,worldId:game.world.id}))},'item-parts/1');
}


export function selectRememberedJournal(game,id){
 const journal=journalChoices(game).find(j=>j.id===id);
 if(!journal)throw Error('Bitte genau ein zugängliches Welt-Journal auswählen.');
 select({kind:'journal',id:journal.id,name:journal.name,worldId:game.world.id},'journal-parts/1');
}

export function selectRememberedJournals(game,ids){
 const available=new Map(journalChoices(game).map(j=>[j.id,j]));
 if(!Array.isArray(ids)||!ids.length||ids.length>50||new Set(ids).size!==ids.length||ids.some(id=>!available.has(id)))throw Error('Bitte 1 bis 50 zugängliche Welt-Journals auswählen.');
 select({kind:'journals',journals:ids.map(id=>({kind:'journal',id,name:available.get(id).name,worldId:game.world.id}))},'journal-parts/1');
}
