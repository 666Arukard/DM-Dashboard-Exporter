import { monsterFixture } from './monster.mjs';

// Vollständig erfundene Testwerte und Texte, keine Inhalte aus Monsterbüchern.
export function statblockFixture() {
  const f = monsterFixture(), s = f.actor.system;
  f.game.system.version = '6.0.4';
  s.traits.size = 'large'; s.details.type = { value: 'elemental', subtype: 'Test', custom: '', swarm: '' }; s.details.alignment = 'Neutral';
  s.attributes.prof = 4; s.attributes.hp.formula = '8d10 + 16';
  s.abilities = { str: { value: 20, mod: 5, save: { value: 9, prof: { multiplier: 1 } } }, dex: { value: 10, mod: 0, save: { value: 0, prof: { multiplier: 0 } } } };
  s.skills.prc.total = 8; s.skills.prc.value = 1;
  s.attributes.movement = { speeds: { walk: 30, fly: 60, swim: 0 }, units: 'ft', hover: true, special: 'Nur für den synthetischen Test.' };
  s.resources = { legact: { max: 3, spent: 1, value: 2, label: 'Zwei synthetische Aktionspunkte verfügbar.' }, legres: { max: 3, spent: 0, value: 3 }, lair: { value: true, initiative: 20, inside: false } };
  const item = (id, name, category, body) => ({ id, name, type: category === 'spell' ? 'spell' : 'feat', system: { properties: new Set(category === 'trait' ? ['trait'] : []), description: { value: body }, uses: { max: 3, spent: 0, value: 3, label: '3 / Tag', recovery: [{ period: 'lr', type: 'recoverAll', formula: '' }] }, activities: category === 'trait' ? [] : [{ id: id + '-activity', name: 'Testaktivität', type: 'utility', activation: { type: category, value: 1 }, labels: {} }] } });
  const strike = item('strike','Testschlag','action','<p>Ein erfundener Angriff &amp; sein Effekt.</p><p>Kein offizieller Monstertext.</p>');
  strike.type = 'weapon';
  strike.system.activities = [{ id: 'attack', name: 'Testangriff', type: 'attack', activation: { type: 'action', value: 1, condition: 'Ziel muss sichtbar sein.' }, labels: { toHit: '+9', range: '10 ft', target: '1 Ziel', damage: [{ formula: '2d8 + 5', label: '2d8 + 5 Wucht' }] }, description: { value: '<p>Zusätzlicher Aktivitätstext.</p>' } },
    { id: 'save', name: 'Testrettungswurf', type: 'save', activation: { type: 'bonus', value: 1 }, save: { ability: new Set(['dex']), dc: { value: 17 } }, labels: { save: 'SG 17', duration: '1 Runde' }, uses: { max: 1, spent: 1, value: 0, recovery: [{ period: 'recharge', type: 'recoverAll', formula: '5' }] } }];
  f.actor.items = [item('resistance','Legendäre Resistenz (Test)','trait','<p>Eine synthetische Resistenzbeschreibung.</p>'), strike,
    ...['bonus','reaction','legendary','mythic','lair','spell','special'].map(category => item(category, 'Test ' + category, category, '<p>Erfundene Fähigkeit: ' + category + '.</p>'))];
  return f;
}
