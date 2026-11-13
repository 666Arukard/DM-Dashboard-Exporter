// Lesender Adapter für vorbereitete dnd5e-6.0.3/6.0.4/6.0.5-Daten. Keine Roll-/Prepare-/Update-Aufrufe.
const text = value => typeof value === 'string' && value.trim() ? value.trim() : null;
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const scalar = value => text(value) ?? (number(value) === null ? null : String(value));
const collection = value => Array.isArray(value) ? value : value?.contents ?? (value?.values ? [...value.values()] : null);

// Nur Text, kein HTML-Vertrauensmechanismus: Die Oberfläche verwendet immer textContent.
export function descriptionText(value) {
  if (!text(value)) return null;
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…' };
  return value.replace(/<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\s*\/?\s*>|<\/(?:p|div|li|h[1-6]|tr|section)\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '• ').replace(/<\/(?:td|th)\s*>/gi, ' | ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
      if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? match;
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '�';
    }).replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim() || null;
}

export function monsterStatblock(game, actor, warnings) {
  const s = actor.system ?? {}, config = globalThis.CONFIG?.DND5E ?? {};
  const label = (id, map) => {
    const value = text(map?.[id]?.label ?? map?.[id]);
    return value ? text(game.i18n?.localize(value)) ?? value : id;
  };
  const description = value => {
    const result = descriptionText(value);
    if (result && /@(?:UUID|Embed|Compendium)\[|\[\[|\[\//.test(result)) {
      const warning = 'Beschreibungen enthalten Foundry-Verweise oder Würfelbefehle. Diese bleiben als Text erhalten und werden nicht ausgeführt; verlinkte Inhalte sind nicht automatisch offline enthalten.';
      if (!warnings.includes(warning)) warnings.push(warning);
    }
    return result;
  };
  const features = embeddedFeatures(game, actor, warnings);
  const movement = s.attributes?.movement;
  const resource = value => value ? { max: number(value.max), spent: number(value.spent), remaining: number(value.value), description: description(value.label) } : null;
  const overrides = actor.flags?.dnd5e?.statBlockOverride;
  const displayOverrides = [];
  for (const key of ['ac','hp','tempHP','speed','cr','xp','pb','gear','saves','skills','senses','languages','vulnerabilities','resistances','immunities','conditionImmunities','size','type','alignment']) {
    const value = description(overrides?.[key]); if (value) displayOverrides.push({ key, value });
  }
  if(Array.isArray(overrides?.abilities))for(const entry of overrides.abilities){
    const value=description(entry?.description);if(!value)continue;
    const names=Array.isArray(entry.abilities)?entry.abilities.filter(id=>typeof id==='string').map(id=>label(id,config.abilities)):[];
    displayOverrides.push({key:'abilities',value:(names.length?names.join(', ')+': ':'')+value});
  }
  if (displayOverrides.length) warnings.push('Foundry enthält manuelle Statblock-Anzeigen. Sie sind zusätzlich aufgeführt; die Zahlen stammen weiterhin aus den vorbereiteten Werten.');
  return {
    size: s.traits?.size ? label(s.traits.size, config.actorSizes) : null,
    creatureType: s.details?.type ? { name: label(s.details.type.value, config.creatureTypes) ?? null, subtype: text(s.details.type.subtype), custom: text(s.details.type.custom), swarm: text(s.details.type.swarm) } : null,
    alignment: text(s.details?.alignment), hpFormula: text(s.attributes?.hp?.formula), proficiencyBonus: number(s.attributes?.prof),
    abilities: s.abilities ? Object.entries(s.abilities).map(([id, value]) => ({ id, label: label(id, config.abilities), score: number(value.value), modifier: number(value.mod), save: number(value.save?.value), saveProficiency: number(value.save?.prof?.multiplier) })) : null,
    skills: s.skills ? Object.entries(s.skills).map(([id, value]) => ({ id, label: label(id, config.skills), total: number(value.total), proficiency: number(value.value) })) : null,
    movement: movement ? { speeds: movement.speeds ? Object.entries(movement.speeds).map(([id, value]) => ({ id, label: label(id, config.movementTypes), value: number(value) })) : null, units: text(movement.units), hover: typeof movement.hover === 'boolean' ? movement.hover : null, special: text(movement.special) } : null,
    legendaryActions: resource(s.resources?.legact), legendaryResistances: resource(s.resources?.legres),
    lair: s.resources?.lair ? { enabled: typeof s.resources.lair.value === 'boolean' ? s.resources.lair.value : null, initiative: number(s.resources.lair.initiative), inside: typeof s.resources.lair.inside === 'boolean' ? s.resources.lair.inside : null } : null,
    features, displayOverrides
  };
}

export function embeddedFeatures(game, actor, warnings) {
  const config = globalThis.CONFIG?.DND5E ?? {};
  const label = (id, map) => {const value = text(map?.[id]?.label ?? map?.[id]); return value ? text(game.i18n?.localize(value)) ?? value : id;};
  const description = value => {
    const result = descriptionText(value);
    if (result && /@(?:UUID|Embed|Compendium)\[|\[\[|\[\//.test(result)) {
      const warning = 'Beschreibungen enthalten Foundry-Verweise oder Würfelbefehle. Diese bleiben als Text erhalten und werden nicht ausgeführt; verlinkte Inhalte sind nicht automatisch offline enthalten.';
      if (!warnings.includes(warning)) warnings.push(warning);
    }
    return result;
  };
  const uses = value => value ? {
    max: scalar(value.max), spent: number(value.spent), remaining: number(value.value), label: description(value.label),
    recovery: Array.isArray(value.recovery) ? value.recovery.map(entry => ({ period: text(entry.period), type: text(entry.type), formula: scalar(entry.formula) })) : null
  } : null;
  const items = collection(actor.items);
  if (!items) warnings.push('Eingebettete Fähigkeiten/Items nicht verfügbar. Der Statblock ist unvollständig.');
  const features = items?.map(item => {
    const system = item.system ?? {}, activities = collection(system.activities);
    const properties = system.properties instanceof Set ? [...system.properties] : Array.isArray(system.properties) ? system.properties : [];
    const category = properties.includes('trait') ? 'trait' : item.type === 'spell' ? 'spell' : text(activities?.[0]?.activation?.type) ?? (item.type === 'feat' ? 'trait' : 'other');
    return {
      sourceId: text(item.id ?? item._id), name: text(item.name), type: text(item.type), category,
      description: description(system.description?.value), uses: uses(system.uses),
      activities: activities?.map(activity => {
        const labels = activity.labels ?? {};
        // Vorbereitete Anzeigen enthalten auch die von Foundry ermittelten Boni/Schadensformeln.
        const details = [];
        for (const key of ['activation', 'range', 'reach', 'target', 'duration', 'toHit', 'save', 'recharge']) {
          const value = description(labels[key]); if (value) details.push({ key, value });
        }
        if (activity.activation?.value !== undefined) details.push({ key: 'cost', value: scalar(activity.activation.value) ?? 'Nicht verfügbar' });
        const condition = description(activity.activation?.condition); if (condition) details.push({ key: 'condition', value: condition });
        const damage = Array.isArray(labels.damage) ? labels.damage.map(part => ({ formula: text(part.formula), label: description(part.label) })) : null;
        if (activity.type === 'attack' && !text(labels.toHit)) warnings.push(`${item.name}: vorbereiteter Angriffsbonus fehlt; Beschreibung vergleichen.`);
        return { sourceId: text(activity.id ?? activity._id), name: text(activity.name), type: text(activity.type), activation: text(activity.activation?.type),
          description: description(activity.description?.value), details, damage,
          saveDC: number(activity.save?.dc?.value), saveAbilities: activity.save?.ability instanceof Set || Array.isArray(activity.save?.ability)
            ? [...activity.save.ability].map(id => label(id, config.abilities)) : null,
          uses: uses(activity.uses) };
      }) ?? null
    };
  }) ?? null;
  return features;
}
