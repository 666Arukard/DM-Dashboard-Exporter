import { monsterStatblock } from './monster-statblock.mjs';
import { attachImages } from './images.mjs';
import { embeddedItems } from './embedded-items.mjs';
import { systemWarnings,assertEnvironment, MODULE_VERSION } from './export-character.mjs';
import { characterDetails } from './character-details.mjs';

const idOf = value => typeof value === 'string' ? value : value?.id ?? value?._id ?? null;
const entries = collection => collection?.contents ?? [...(collection?.values?.() ?? [])];

export function monsterPacks(game) {
  assertEnvironment(game);
  return entries(game.packs).filter(pack => pack.documentName === 'Actor' && pack.visible)
    .map(pack => ({ id: pack.collection, name: pack.title ?? pack.metadata?.label ?? pack.collection }));
}

function getPack(game, packId) {
  assertEnvironment(game);
  const pack = game.packs?.get(packId);
  if (!pack || pack.documentName !== 'Actor' || !pack.visible) throw new Error('Bitte ein zugängliches Actor-Compendium auswählen.');
  return pack;
}

export function folderPath(pack, folderId) {
  const path = [], seen = new Set();
  let id = folderId;
  while (id) {
    if (seen.has(id)) throw new Error('Die Compendium-Ordner enthalten einen Kreis. Export abgebrochen.');
    seen.add(id);
    const folder = pack.folders?.get(id);
    if (!folder || typeof folder.name !== 'string' || !folder.name) throw new Error('Compendium-Ordner nicht auflösbar. Bitte das Compendium öffnen und erneut versuchen.');
    path.unshift({ id, name: folder.name });
    id = idOf(folder.folder);
  }
  return path;
}

export async function monsterCatalog(game, packId) {
  const pack = getPack(game, packId);
  const index = await pack.getIndex({ fields: ['type', 'folder'] });
  getPack(game, packId); // Berechtigung auch nach dem Warten prüfen.
  return entries(index).filter(actor => actor.type === 'npc').map(actor => {
    const folderId = idOf(actor.folder);
    return { id: actor._id ?? actor.id, name: actor.name, folderId, path: folderPath(pack, folderId) };
  }).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export async function exportMonster(game, packId, actorId, expectedFolderId, now = new Date(), withImages = false) {
  const pack = getPack(game, packId);
  if (typeof actorId !== 'string' || !actorId) throw new Error('Bitte genau ein Monster auswählen.');
  const actor = await pack.getDocument(actorId);
  getPack(game, packId);
  if (!actor || actor.id !== actorId || actor.type !== 'npc' || actor.isToken || actor.pack !== packId) throw new Error('Der ausgewählte Eintrag ist kein Monster dieses Compendiums.');
  const folderId = idOf(actor.folder);
  if (folderId !== expectedFolderId) throw new Error('Das Monster wurde inzwischen verschoben. Bitte Ordner erneut auswählen.');
  const path = folderPath(pack, folderId);
  const warnings = systemWarnings(game);
  const number = (value, name) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    warnings.push(`${name}: nicht verfügbar; als null exportiert.`); return null;
  };
  if (Number(game.release.build) !== 368) warnings.push('Foundry-Build weicht vom Zielstand 14.368 ab. Werte vergleichen.');
  const attributes = actor.system?.attributes ?? {};
  const shared = characterDetails(game, actor, warnings, { monster: true });
  const details = Object.fromEntries(['passive', 'resistances', 'vulnerabilities', 'damageImmunities', 'conditionImmunities', 'senses', 'languages'].map(key => [key, shared[key]]));
  let cr = number(actor.system?.details?.cr, 'Herausforderungsgrad');
  if (cr !== null && cr < 0) { warnings.push('Negativer Herausforderungsgrad: als null exportiert.'); cr = null; }
  const data = {
    kind: 'monster', schemaVersion: '1.1.0', exportedAt: now.toISOString(),
    source: {
      worldId: game.world.id, foundryVersion: String(game.version), foundryBuild: Number(game.release.build),
      systemId: game.system.id, systemVersion: game.system.version, exporterVersion: MODULE_VERSION,
      ddbImporterVersion: game.modules?.get('ddb-importer')?.version ?? null,
      packId, packName: pack.title ?? pack.metadata?.label ?? packId, folderPath: path
    },
    monster: {
      sourceId: actor.id, name: actor.name, challengeRating: cr,
      hp: { current: number(attributes.hp?.value, 'Aktuelle HP'), max: number(attributes.hp?.max, 'Maximale HP'), effectiveMax: number(attributes.hp?.effectiveMax, 'Effektive maximale HP') },
      armorClass: number(attributes.ac?.value, 'Rüstungsklasse'),
      initiative: { modifier: number(attributes.init?.total, 'Initiativbonus'), combatTotal: null, combatId: null, combatantId: null },
      details, statblock: monsterStatblock(game, actor, warnings)
    }, warnings
  };
  if (!withImages) return data;
  const result = await attachImages(data, actor);
  result.monster.statblock.features = embeddedItems(game, actor, result.warnings, {monster:true});
  result.schemaVersion = '1.3.0';
  result.warnings = [...new Set(result.warnings)];
  getPack(game, packId);
  if (idOf(actor.folder) !== expectedFolderId) throw new Error('Monster wurde während des Exports verschoben.');
  return result;
}
