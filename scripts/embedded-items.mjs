import { embeddedFeatures, descriptionText } from './monster-statblock.mjs';

const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const bool = value => typeof value === 'boolean' ? value : null;
const scalar = value => text(value) ?? (number(value) === null ? null : String(value));
const collection = value => Array.isArray(value) ? value : value?.contents ?? (value?.values ? [...value.values()] : null);
const characterTypes = new Set(['weapon','equipment','consumable','tool','loot','container','spell','feat']);

/** Nur bereits eingebettete Dokumente. Keine UUID-Auflösung, Compendium-Suche oder Berechnung. */
export function embeddedItems(game, actor, warnings, {monster = false, standalone = false} = {}) {
  const all = collection(actor.items);
  if (!all) { warnings.push('Eingebettete Items nicht verfügbar; als unbekannt exportiert.'); return null; }
  const items = (monster || standalone) ? all : all.filter(item => characterTypes.has(item.type));
  const features = embeddedFeatures(game, {items}, warnings);
  const config = globalThis.CONFIG?.DND5E ?? {};
  const label = (id, map) => {
    const value = text(map?.[id]?.label ?? map?.[id]);
    return value ? text(game.i18n?.localize(value)) ?? value : id;
  };
  return features.map((feature,index) => {
    const item = items[index], s = item.system ?? {};
    const properties = s.properties instanceof Set || Array.isArray(s.properties) ? new Set(s.properties) : null;
    const physical = ['weapon','equipment','consumable','tool','loot','container'].includes(item.type);
    const rangeOrDuration = (value, display) => value ? {
      value:scalar(value.value), units:text(value.units), special:descriptionText(value.special), label:descriptionText(display)
    } : null;
    const spell = item.type === 'spell' ? {
      level:number(s.level), school:text(s.school) ? {id:s.school,label:label(s.school,config.spellSchools)} : null,
      prepared:number(s.prepared), method:text(s.method),
      components:properties ? ['vocal','somatic','material'].filter(key=>properties.has(key)) : null,
      concentration:properties ? properties.has('concentration') : null,
      ritual:properties ? properties.has('ritual') : null,
      activation:s.activation ? {type:text(s.activation.type),value:number(s.activation.value),condition:descriptionText(s.activation.condition),label:descriptionText(item.labels?.activation)} : null,
      range:rangeOrDuration(s.range,item.labels?.range), duration:rangeOrDuration(s.duration,item.labels?.duration),
      materials:s.materials ? {description:descriptionText(s.materials.value),consumed:bool(s.materials.consumed),cost:number(s.materials.cost),supply:number(s.materials.supply)} : null
    } : null;
    return {...feature, itemDetails:{
      quantity:physical ? number(s.quantity) : null,
      equipped:physical ? bool(s.equipped) : null,
      attunement:physical && typeof s.attunement === 'string' ? s.attunement : null,
      attuned:physical ? bool(s.attuned) : null,
      spell
    }};
  });
}
