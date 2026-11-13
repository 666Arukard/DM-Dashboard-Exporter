// Vorbereitete dnd5e-Bewegungswerte; keine Berechnung oder Änderung am Actor.
export function characterMovement(game,actor) {
 const m=actor.system?.attributes?.movement;
 if(!m||typeof m!=='object')return null;
 const text=v=>typeof v==='string'&&v.trim()?v.trim():null;
 const labels=globalThis.CONFIG?.DND5E?.movementTypes??{};
 const fallback={walk:'Laufen',fly:'Fliegen',swim:'Schwimmen',climb:'Klettern',burrow:'Graben'};
 return {
  speeds:m.speeds&&typeof m.speeds==='object'&&!Array.isArray(m.speeds)?Object.entries(m.speeds).map(([id,value])=>{
   const key=text(labels[id]?.label??labels[id]);
   return {id,label:(key?(text(game.i18n?.localize(key))??key):null)??fallback[id]??id,value:typeof value==='number'&&Number.isFinite(value)?value:null};
  }):null,
  units:text(m.units),hover:typeof m.hover==='boolean'?m.hover:null,special:text(m.special)
 };
}
