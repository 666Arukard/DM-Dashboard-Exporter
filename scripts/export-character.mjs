import {characterMovement} from './character-movement.mjs';
import { attachImages } from './images.mjs';
import { embeddedItems } from './embedded-items.mjs';
import { characterDetails } from "./character-details.mjs";
export const MODULE_ID = "dnd-dm-exporter";
export const MODULE_VERSION = "0.30.0";

const notifiedVersions=new Set();
export function assertEnvironment(game) {
  if (!game.user?.isGM) throw new Error("Nur die Spielleitung darf diesen Export starten.");
  const version=game.system?.version;
  const match=typeof version==='string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.exec(version);
  const parts=match && match.slice(1,4).map(Number);
  if(game.system?.id!=='dnd5e'||!parts||!parts.every(Number.isSafeInteger)||parts[0]<6||(parts[0]===6&&parts[1]===0&&parts[2]<3)){
    throw Error('D&D5e ab Version 6.0.3 mit gültiger Versionsnummer erforderlich.');
  }
  if (Number(game.release?.generation) !== 14) {
    throw new Error("Dieser Prototyp ist für Foundry 14 vorgesehen.");
  }
  const warning=systemWarnings(game)[0];
  if(warning && !notifiedVersions.has(version) && globalThis.ui?.notifications?.warn){globalThis.ui.notifications.warn(warning);notifiedVersions.add(version);}
}

export function getCharacter(game, actorId) {
  assertEnvironment(game);
  const actor = game.actors.get(actorId);
  if (!actor || actor.type !== "character" || actor.isToken || actor.pack) {
    throw new Error("Bitte einen vorhandenen Welt-Charakter auswählen.");
  }
  return actor;
}

export function combatChoices(game, actorId) {
  getCharacter(game, actorId);
  const choices = [];
  for (const combat of game.combats ?? []) {
    for (const combatant of combat.combatants ?? []) {
      if (combatant.actorId === actorId) choices.push({ combat, combatant });
    }
  }
  return choices;
}

/** Liest ausschließlich vorbereitete Werte. Keine Neuberechnung, Würfe oder Dokument-Schreibmethoden. */
export function exportCharacter(game, actorId, selection = null, now = new Date()) {
  const actor = getCharacter(game, actorId);
  const warnings = systemWarnings(game);
  const number = (value, label) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    warnings.push(`${label}: kein gültiger Zahlenwert verfügbar; als null exportiert.`);
    return null;
  };
  if (![368,369].includes(Number(game.release.build))) {
    warnings.push("Dieser Foundry-Build weicht vom geprüften Stand 14.368/14.369 ab. Werte vor Verwendung mit Foundry vergleichen.");
  }
  const attributes = actor.system?.attributes ?? {};
  let combatTotal = null;
  let combatId = null;
  let combatantId = null;
  if (selection !== null) {
    const combat = game.combats?.get(selection.combatId);
    const combatant = combat?.combatants.get(selection.combatantId);
    if (!combatant || combatant.actorId !== actor.id) {
      throw new Error("Der ausgewählte Kampfteilnehmer ist nicht mehr diesem Charakter zugeordnet. Bitte erneut auswählen.");
    }
    combatId = combat.id;
    combatantId = combatant.id;
    if (combatant.initiative === null || combatant.initiative === undefined) {
      warnings.push("Für den ausgewählten Kampfteilnehmer ist noch kein Initiative-Gesamtwert eingetragen.");
    } else combatTotal = number(combatant.initiative, "Initiative-Gesamtwert");
    if (combatant.actor?.isToken) {
      warnings.push("Kampfwert stammt von einem nicht verknüpften Token. HP, RK und Bonus stammen ausdrücklich vom Welt-Charakter, nicht vom Token.");
    }
  }
  const result = {
    schemaVersion: "1.1.0",
    exportedAt: now.toISOString(),
    source: {
      worldId: game.world.id,
      foundryVersion: String(game.version),
      foundryBuild: Number(game.release.build),
      systemId: game.system.id,
      systemVersion: game.system.version,
      exporterVersion: MODULE_VERSION,
      ddbImporterVersion: game.modules?.get("ddb-importer")?.version ?? null
    },
    character: {
      sourceId: actor.id,
      name: actor.name,
      hp: {
        current: number(attributes.hp?.value, "Aktuelle HP"),
        max: number(attributes.hp?.max, "Maximale HP"),
        effectiveMax: number(attributes.hp?.effectiveMax, "Effektive maximale HP")
      },
      armorClass: number(attributes.ac?.value, "Rüstungsklasse"),
      details: characterDetails(game, actor, warnings),
      initiative: {
        modifier: number(attributes.init?.total, "Initiativbonus"),
        combatTotal, combatId, combatantId
      }
    },
    warnings
  };
  validateExport(result);
  return result;
}

export function validateExport(data) {
  const requiredString = value => typeof value === "string" && value.length > 0;
  const nullableNumber = value => value === null || (typeof value === "number" && Number.isFinite(value));
  const c = data?.character;
  const s = data?.source;
  const i = c?.initiative;
  if (data?.schemaVersion !== "1.1.0" || !requiredString(data.exportedAt)
    || !Number.isFinite(Date.parse(data.exportedAt))
    || ![s?.worldId, s?.foundryVersion, s?.systemId, s?.systemVersion, s?.exporterVersion, c?.sourceId, c?.name].every(requiredString)
    || !Number.isInteger(s?.foundryBuild) || s.foundryBuild < 0
    || !(s.ddbImporterVersion === null || requiredString(s.ddbImporterVersion))
    || ![c?.hp?.current, c?.hp?.max, c?.hp?.effectiveMax, c?.armorClass, i?.modifier, i?.combatTotal].every(nullableNumber)
    || !((i.combatId === null && i.combatantId === null && i.combatTotal === null)
      || (requiredString(i.combatId) && requiredString(i.combatantId)))
    || !Array.isArray(data.warnings) || !data.warnings.every(requiredString)) {
    throw new Error("Exportdaten sind unvollständig oder ungültig. Es wurde keine Datei erstellt.");
  }
  return data;
}

export function selectedCharacters(game, selection) {
  const ids = Array.isArray(selection) ? [...selection] : [selection];
  if (!ids.length || ids.length > 50 || new Set(ids).size !== ids.length) throw new Error('Bitte 1 bis 50 unterschiedliche Charaktere auswählen.');
  ids.forEach(id => getCharacter(game, id));
  return ids;
}

export function exportCharacters(game, selection, now = new Date()) {
  const ids = selectedCharacters(game, selection);
  const exports = ids.map(id => exportCharacter(game, id, null, now));
  return exports.length === 1 ? exports[0] : { batchVersion: '1.0.0', exports };
}

export async function exportCharacterWithImages(game, actorId, selection = null, now = new Date()) {
  const actor = getCharacter(game, actorId);
  const data = exportCharacter(game, actorId, selection, now);
  const result = await attachImages(data, actor);
  result.character.items = embeddedItems(game, actor, result.warnings);
  result.character.details.movement = characterMovement(game, actor);
  result.schemaVersion = '1.4.0';
  getCharacter(game, actorId);
  if (game.world.id !== data.source.worldId) throw new Error('Die freigegebene Welt hat sich geändert.');
  return result;
}





/** Zulassung neuer Versionen ist keine Aussage über geprüfte Feldkompatibilität. */
export function systemWarnings(game){
 return ['6.0.3','6.0.4','6.0.5','6.0.6','6.1.0'].includes(game.system?.version)?[]:[`D&D5e ${game.system?.version}: noch ungeprüfte Spielsystemversion. Exportwerte mit Foundry vergleichen; geänderte Felder können fehlen.`];
}
