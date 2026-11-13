import { exportCharacters, exportCharacterWithImages, selectedCharacters, getCharacter } from './export-character.mjs';
import { assertEnvironment } from './export-character.mjs';
import { exportMonster, monsterPacks } from './export-monster.mjs';

let activeConnection;
export function replaceConnection(next) { activeConnection?.close(); activeConnection = next; }
export function connectionSummary() {
  return activeConnection?.popup && !activeConnection.popup.closed
    ? 'Verbindungsfenster geöffnet. Den bestätigten Verbindungsstatus und einen laufenden Abruf bitte im Testprogramm prüfen.'
    : 'Kein Verbindungsfenster geöffnet. Im Testprogramm einen Verbindungslink erstellen und bei der gewünschten Auswahl einfügen.';
}

/** Die Freigabe bindet 1–50 ausdrücklich gewählte Monster an Welt, Compendium und ihren jeweiligen Ordner. */
export function connectMonster(game, selection, link, hostWindow = window, notify = () => {}) {
  const selections = Array.isArray(selection) ? selection : [selection];
  if (!selections.length || selections.length > 50 || new Set(selections.map(s => s.id)).size !== selections.length) throw new Error('Bitte 1 bis 50 unterschiedliche Monster auswählen.');
  const choices = selections.map(s => ({ kind: 'monster', id: s.id, name: s.name, worldId: game.world.id, packId: s.packId, folderId: s.folderId }));
  const chosen = choices[0];
  if (choices.some(s => s.packId !== chosen.packId || !(s.folderId === null || typeof s.folderId === 'string' && s.folderId.length > 0) || ![s.id,s.name,s.packId].every(v => typeof v === 'string' && v.length > 0))) throw new Error('Monster müssen aus demselben Compendium stammen und einen gültigen Ordnerbezug haben.');
  const check = () => {
    assertEnvironment(game);
    if (game.world.id !== chosen.worldId || !monsterPacks(game).some(p => p.id === chosen.packId)) throw new Error('Die freigegebene Welt oder das Compendium ist nicht mehr zugänglich. Bitte neu koppeln.');
  };
  check();
  if (![chosen.id, chosen.name, chosen.packId].every(v => typeof v === 'string' && v.length > 0)
    || !(chosen.folderId === null || typeof chosen.folderId === 'string' && chosen.folderId.length > 0)) throw new Error('Bitte genau ein Monster und seinen Ordner auswählen.');
  const config = parseLink(link);
  const popup = hostWindow.open(config.url, '_blank', 'popup,width=560,height=520');
  if (!popup) throw new Error('Das Verbindungsfenster wurde blockiert. Bitte Pop-ups für diese Foundry-Seite erlauben und erneut verbinden.');
  const processed = new Set(), packetTimes=new Map(); let active = true;
  const send = message => { if (active && !popup.closed) popup.postMessage({ protocol: 'dnd-dm/1', session: config.session, ...message }, config.origin); };
  const receive = async event => {
    if (!active || event.origin !== config.origin || event.source !== popup || event.data?.protocol !== 'dnd-dm/1' || event.data.session !== config.session) return;
    try {
      check();
      if (event.data.type === 'hello') send({ type: 'ready', transfer:'monster-parts/1', selection: choices.length === 1 ? chosen : { kind: 'monsters', monsters: choices } });
      if (event.data.type === 'ping') send({ type: 'pong' });
      if (event.data.type === 'export-part' && /^[a-f0-9]{64}$/.test(event.data.requestId)) {
        const {requestId,index}=event.data;
        if (!Number.isInteger(index) || index<0 || index>=choices.length) throw new Error('Ungültiger Paketindex.');
        const key=requestId+':'+index;
        if (processed.has(key)) return;
        processed.add(key);if(processed.size>100)processed.delete(processed.values().next().value);
        if (!packetTimes.has(requestId)) {packetTimes.set(requestId,new Date());if(packetTimes.size>100)packetTimes.delete(packetTimes.keys().next().value);}
        const entry=choices[index],data=await exportMonster(game,entry.packId,entry.id,entry.folderId,packetTimes.get(requestId), true);
        check();
        const text=JSON.stringify(data);
        if (new TextEncoder().encode(text).length>3*1024*1024) throw new Error('Ein Monster überschreitet das Paketlimit von 3 MB. Bitte dieses Monster aus der Auswahl nehmen.');
        send({type:'part',requestId,index,text});
      }
      if (event.data.type === 'export' && /^[a-f0-9]{64}$/.test(event.data.requestId) && !processed.has(event.data.requestId)) {
        processed.add(event.data.requestId);
        if (processed.size > 100) processed.delete(processed.values().next().value);
        const exports = [];
        const now = new Date();
        for (const entry of choices) {
          if (!active || popup.closed) return;
          check();
          exports.push(await exportMonster(game, entry.packId, entry.id, entry.folderId, now, true));
        }
        const data = exports.length === 1 ? exports[0] : { batchVersion: '1.1.0', kind: 'monsters', exports };
        check();
        const text = JSON.stringify(data);
        if (new TextEncoder().encode(text).length > 3 * 1024 * 1024) throw new Error('Monsterauswahl überschreitet die Grenze von 3 MB. Bitte weniger Monster auswählen und neu koppeln.');
        send({ type: 'result', requestId: event.data.requestId, text });
      }
    } catch (error) { notify(error.message); send({ type: 'error', requestId: event.data.requestId }); }
  };
  hostWindow.addEventListener('message', receive);
  const cleanup = () => { active = false; hostWindow.removeEventListener('message', receive); clearInterval(timer); };
  const timer = setInterval(() => { if (popup.closed) cleanup(); }, 2000); timer.unref?.();
  return { popup, close: () => { cleanup(); popup.close(); } };
}

export function parseLink(value) {
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Bitte den vollständigen Verbindungslink aus dem Testprogramm einfügen.'); }
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.pathname !== '/bridge'
    || url.username || url.password || url.search || !/^#[a-f0-9]{64}$/.test(url.hash)) {
    throw new Error('Ungültiger Verbindungslink. Er muss vom lokalen Testprogramm stammen.');
  }
  return { url: url.href, origin: url.origin, session: url.hash.slice(1) };
}

/** Nur explizit ausgewählte Welt-Actors, einschließlich ihrer Bildreferenzen. */
export function connectCharacter(game, actorId, link, hostWindow = window, notify = () => {}) {
  const ids = selectedCharacters(game, actorId);
  const actors = ids.map(id => ({ id, name: getCharacter(game, id).name, worldId: game.world.id }));
  const config = parseLink(link);
  const popup = hostWindow.open(config.url, '_blank', 'popup,width=560,height=520');
  if (!popup) throw new Error('Das Verbindungsfenster wurde blockiert. Bitte Pop-ups für diese Foundry-Seite erlauben und erneut verbinden.');
  const processed = new Set(), packetTimes = new Map(); let active = true;
  const send = message => { if (active && !popup.closed) popup.postMessage({ protocol: 'dnd-dm/1', session: config.session, ...message }, config.origin); };
  const check = () => {
    ids.forEach(id => getCharacter(game, id));
    if (game.world.id !== actors[0].worldId) throw new Error('Die freigegebene Welt hat sich geändert.');
  };
  const receive = async event => {
    if (!active || event.origin !== config.origin || event.source !== popup || event.data?.protocol !== 'dnd-dm/1' || event.data.session !== config.session) return;
    try {
      check();
      if (event.data.type === 'hello') send({ type: 'ready', transfer:'character-parts/1', actor: actors[0], actors });
      if (event.data.type === 'ping') send({ type: 'pong' });
      if (event.data.type === 'export-part' && /^[a-f0-9]{64}$/.test(event.data.requestId)) {
        const {requestId,index} = event.data;
        if (!Number.isInteger(index) || index < 0 || index >= ids.length) throw new Error('Ungültiger Paketindex.');
        const key = requestId + ':' + index;
        if (processed.has(key)) return;
        processed.add(key); if (processed.size > 100) processed.delete(processed.values().next().value);
        if (!packetTimes.has(requestId)) { packetTimes.set(requestId,new Date()); if (packetTimes.size>100) packetTimes.delete(packetTimes.keys().next().value); }
        const data = await exportCharacterWithImages(game,ids[index],null,packetTimes.get(requestId));
        check();
        const text = JSON.stringify(data);
        if (new TextEncoder().encode(text).length > 3*1024*1024) throw new Error('Ein Charakter überschreitet das Paketlimit von 3 MB.');
        send({type:'part',requestId,index,text});
      }
      if (event.data.type === 'export' && /^[a-f0-9]{64}$/.test(event.data.requestId) && !processed.has(event.data.requestId)) {
        processed.add(event.data.requestId);
        if (processed.size > 100) processed.delete(processed.values().next().value);
        send({ type: 'result', requestId: event.data.requestId, text: JSON.stringify(exportCharacters(game, ids)) });
      }
    } catch (error) {
      notify(error.message);
      send({ type: 'error', requestId: event.data.requestId });
    }
  };
  hostWindow.addEventListener('message', receive);
  const cleanup = () => { active = false; hostWindow.removeEventListener('message', receive); clearInterval(timer); };
  const timer = setInterval(() => { if (popup.closed) cleanup(); }, 2000);
  timer.unref?.();
  return { popup, close: () => { cleanup(); popup.close(); } };
}

