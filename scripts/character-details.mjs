// Feldzuordnung für dnd5e 6.0.3–6.0.6 sowie 6.1.0, ausschließlich vorbereitete Werte lesen.
export function characterDetails(game, actor, warnings, { monster = false } = {}) {
  const system = actor.system ?? {};
  const config = globalThis.CONFIG?.DND5E ?? {};
  const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
  const number = (value, name) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    warnings.push(`${name}: nicht verfügbar; als null exportiert.`);
    return null;
  };
  const findLabel = (entries, key) => {
    if (!entries || typeof entries !== 'object') return null;
    if (Object.hasOwn(entries, key)) return text(entries[key]?.label ?? entries[key]);
    for (const entry of Object.values(entries)) {
      const result = findLabel(entry?.children, key);
      if (result) return result;
    }
    return null;
  };
  const label = (key, entries) => {
    if (key === 'ALL') return 'Alle';
    const value = findLabel(entries, key);
    return value ? text(game.i18n?.localize(value)) ?? value : key;
  };
  const values = (value, entries, name) => {
    if (!(value instanceof Set) && !Array.isArray(value)) {
      warnings.push(`${name}: Auswahl nicht verfügbar.`);
      return null;
    }
    return [...value].filter(id => {
      if (text(id)) return true;
      warnings.push(`${name}: ungültiger Eintrag ausgelassen.`); return false;
    }).map(id => ({ id, label: label(id, entries) }));
  };
  const trait = (key, entries, name) => {
    const source = system.traits?.[key];
    if (!source) return null;
    return {
      values: values(source.value, entries, name), custom: text(source.custom),
      bypasses: key === 'ci' ? [] : values(source.bypasses, config.itemProperties, `${name} – Ausnahmen`)
    };
  };
  const documentName = value => text(typeof value === 'string' ? value : value?.name);
  const items = actor.items?.contents ?? (actor.items?.values ? [...actor.items.values()] : Array.isArray(actor.items) ? actor.items : null);
  const senses = system.attributes?.senses;
  const languages = system.traits?.languages;
  return {
    passive: {
      perception: number(system.skills?.prc?.passive, 'Passive Wahrnehmung'),
      investigation: number(system.skills?.inv?.passive, 'Passive Nachforschungen'),
      insight: number(system.skills?.ins?.passive, 'Passive Einsicht')
    },
    level: monster ? null : number(system.details?.level, 'Gesamtstufe'),
    classes: items?.filter(item => item.type === 'class').map(item => ({
      name: documentName(item), level: number(item.system?.levels, 'Klassenstufe')
    })) ?? null,
    species: documentName(system.details?.race),
    background: documentName(system.details?.background),
    resistances: trait('dr', {...config.damageTypes,...config.damageResistanceTypes}, 'Resistenzen'),
    vulnerabilities: trait('dv', {...config.damageTypes,...config.damageResistanceTypes}, 'Anfälligkeiten'),
    damageImmunities: trait('di', {...config.damageTypes,...config.damageResistanceTypes}, 'Schadensimmunitäten'),
    conditionImmunities: trait('ci', config.conditionTypes, 'Zustandsimmunitäten'),
    senses: senses ? {
      ranges: senses.ranges && typeof senses.ranges === 'object' ? Object.entries(senses.ranges).map(([id, value]) => ({
        id, label: label(id, config.senses), range: number(value, `Sinn ${id}`)
      })) : null,
      units: text(senses.units), special: text(senses.special)
    } : null,
    languages: languages ? {
      values: values(languages.value, config.languages, 'Sprachen'), custom: text(languages.custom),
      communication: languages.communication && typeof languages.communication === 'object'
        ? Object.entries(languages.communication).map(([id, value]) => ({
          id, label: label(id, config.communicationTypes), range: number(value?.value, `Kommunikation ${id}`), units: text(value?.units)
        })) : null
    } : null
  };
}
