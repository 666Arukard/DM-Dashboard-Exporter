import { gameFixture } from './details.mjs';

// Erfundenes Testmonster; keine Dao-/DDB-Inhalte.
export function monsterFixture() {
  const game = gameFixture();
  const actor = game.actors.get('test-hero');
  actor.type = 'npc'; actor.name = 'Synthetisches Testwesen'; actor.pack = 'test.monsters';
  actor.folder = 'elemental'; actor.system.details.cr = 0.25; actor.items = [];
  delete actor.system.details.level;
  const reads = [];
  const pack = {
    collection: 'test.monsters', title: 'Test Monsters', documentName: 'Actor', visible: true,
    folders: new Map([
      ['rules', { id: 'rules', name: 'Test Rules', folder: null }],
      ['elemental', { id: 'elemental', name: 'Elemental', folder: 'rules' }]
    ]),
    async getIndex() { reads.push('index'); return new Map([[actor.id, { _id: actor.id, name: actor.name, type: actor.type, folder: 'elemental' }]]); },
    async getDocument(id) { reads.push(id); return id === actor.id ? actor : null; },
    configure() { throw new Error('Verbotener Schreibzugriff'); },
    getDocuments() { throw new Error('Kein Vollabruf erlaubt'); }
  };
  game.packs = new Map([[pack.collection, pack]]);
  return { game, actor, pack, reads };
}
