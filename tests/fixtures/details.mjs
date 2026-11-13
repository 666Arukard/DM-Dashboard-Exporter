
// Ausschließlich erfundene Prüfdaten, keine Inhalte einer realen Kampagne.
export function gameFixture() {
  const trait = (value = [], custom = '', bypasses = []) => ({ value: new Set(value), custom, bypasses: new Set(bypasses) });
  const actor = { id: 'test-hero', name: 'Testheld Mira', type: 'character',
    items: [{ type: 'class', name: 'Klasse A', system: { levels: 3 } }, { type: 'class', name: 'Klasse B', system: { levels: 2 } }],
    system: {
      attributes: { hp: { value: 17, max: 24, effectiveMax: 24 }, ac: { value: 16 }, init: { total: 4 }, senses: { ranges: { darkvision: 60, blindsight: 0 }, units: 'ft', special: 'Synthetischer Sinnhinweis' } },
      skills: { prc: { passive: 18, total: 3 }, inv: { passive: 15 }, ins: { passive: 14 } },
      details: { level: 5, race: { name: 'Testspezies' }, background: 'Testhintergrund', biography: { value: 'NICHT EXPORTIEREN' }, ideal: 'NICHT EXPORTIEREN', flaw: 'NICHT EXPORTIEREN' },
      traits: { dr: trait(['fire','bludgeoning'], 'Nur bei Testbedingung', ['mgc']), dv: trait(['cold']), di: trait(['poison']), ci: trait(['poisoned']),
        languages: { value: new Set(['common','elvish','unknown-language']), custom: 'Testsprache', communication: { telepathy: { value: 30, units: 'ft' } } } }
    },
    update() { throw new Error('Verbotener Schreibzugriff'); }, delete() { throw new Error('Verbotener Löschzugriff'); }
  };
  const actors = new Map([[actor.id, actor]]); actors.filter = fn => [...actors.values()].filter(fn);
  return { user: { isGM: true }, version: '14.368', release: { generation: 14, build: 368 }, system: { id: 'dnd5e', version: '6.0.3' }, world: { id: 'synthetic-world' }, actors, modules: new Map(), combats: [] };
}
export const configFixture = { DND5E: { damageTypes: { fire: { label: 'Feuer' }, cold: { label: 'Kälte' }, poison: { label: 'Gift' }, bludgeoning: { label: 'Wucht' } }, conditionTypes: { poisoned: { label: 'Vergiftet' } }, itemProperties: { mgc: { label: 'Magisch' } }, senses: { darkvision: { label: 'Dunkelsicht' }, blindsight: { label: 'Blindsicht' } }, languages: { standard: { children: { common: { label: 'Gemeinsprache' }, elvish: { label: 'Elfisch' } } } }, communicationTypes: { telepathy: { label: 'Telepathie' } } } };
