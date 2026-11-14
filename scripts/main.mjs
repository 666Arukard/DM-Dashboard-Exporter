import {orderedExportButtons} from './dialog-buttons.mjs';
import {JournalExportDialog} from './journal-dialog.mjs';
import {openRemembered,disconnectRemembered,forgetRemembered,selectRememberedCharacters} from './remembered-connection.mjs';
import { ItemExportDialog } from './item-dialog.mjs';
import { MonsterExportDialog } from "./monster-dialog.mjs";
import { MODULE_ID, assertEnvironment, combatChoices, exportCharacterWithImages, selectedCharacters } from "./export-character.mjs";
import { connectCharacter, replaceConnection } from "./network.mjs";
import { registerExportSidebar, overviewContent, bindOverview } from "./export-sidebar.mjs";


export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

const { DialogV2 } = foundry.applications.api;

export async function downloadCharacter(actorId) {
  try {
    assertEnvironment(game);
    const choices = combatChoices(game, actorId);
    let selection = null;
    if (choices.length) {
      const options = choices.map(({ combat, combatant }, index) => {
        const label = `${combat.name || "Kampf"} [${combat.id}] – ${combatant.name || "Teilnehmer"} [${combatant.id}] – Initiative: ${combatant.initiative ?? "nicht eingetragen"}`;
        return `<option value="${index}">${escapeHtml(label)}</option>`;
      }).join("");
      const answer = await DialogV2.input({
        window: { title: "Vorhandenen Kampfwert übernehmen?" },
        content: `<p>Charakterwerte bleiben Werte des Welt-Charakters. Optional einen bestehenden Kampfwert ergänzen; es wird nichts gewürfelt.</p><div class="form-group"><label>Kampfteilnehmer</label><select name="combat"><option value="none">Ohne Kampfwert exportieren</option>${options}</select></div>`,
        ok: { label: "Weiter" }, rejectClose: false
      });
      if (!answer) return;
      if (answer.combat !== "none") {
        const choice = choices[Number(answer.combat)];
        if (!choice) throw new Error("Ungültige Kampfauswahl.");
        selection = { combatId: choice.combat.id, combatantId: choice.combatant.id };
      }
    }
    const data = await exportCharacterWithImages(game, actorId, selection);
    const show = value => value === null ? "nicht verfügbar" : escapeHtml(value);
    const c = data.character;
    const content = `<p><strong>${escapeHtml(c.name)}</strong></p>
      <p>HP: ${show(c.hp.current)} / ${show(c.hp.max)} (effektives Maximum: ${show(c.hp.effectiveMax)})<br>
      Rüstungsklasse: ${show(c.armorClass)}<br>Initiativbonus: ${show(c.initiative.modifier)}<br>
      Initiative-Gesamtwert: ${show(c.initiative.combatTotal)}</p>
      <p>Der Bonus enthält die von D&D5e vorbereiteten numerischen Anteile. Zusätzliche Würfelboni und situationsabhängige Entscheidungen werden nicht ausgewürfelt.</p>
      ${data.warnings.length ? `<p><strong>Hinweise zum Export:</strong></p><ul>${data.warnings.map(w => `<li>${escapeHtml(w)}</li>`).join("")}</ul>` : ""}
      <p>JSON-Datei dieser Momentaufnahme herunterladen?</p>`;
    if (!await DialogV2.confirm({
      window: { title: "Charakterexport prüfen" }, content,
      yes: { label: "JSON herunterladen" }, no: { label: "Abbrechen" }, rejectClose: false
    })) return;
    assertEnvironment(game);
    const safeId = c.sourceId.replace(/[^a-zA-Z0-9_-]/g, "_");
    const text = JSON.stringify(data, null, 2);
    if (new TextEncoder().encode(text).length > 3*1024*1024) throw new Error('JSON-Datei überschreitet 3 MB. Bitte den Netzwerkabruf verwenden.');
    foundry.utils.saveDataToFile(text, "application/json", `dnd-character-${safeId}.json`);
    ui.notifications.info("Charakterexport an den Browser übergeben.");
  } catch (error) {
    ui.notifications.error(error.message || "Der Charakterexport ist fehlgeschlagen.");
  }
}

export class CharacterExportDialog extends DialogV2 {
  async _onRender(context, options) {
    await super._onRender(context, options);
    for (const button of this.element.querySelectorAll('button[data-selection]')) {
      button.onclick = () => {
        try {
          assertEnvironment(game);
          const boxes = [...this.element.querySelectorAll('input[name="actors"]')];
          if (button.dataset.selection === 'all' && boxes.length > 50) {
            ui.notifications.error('Mehr als 50 Charaktere vorhanden. Bitte höchstens 50 manuell auswählen.');
            return;
          }
          for (const box of boxes) box.checked = button.dataset.selection === 'all';
        } catch (error) { ui.notifications.error(error.message); }
      };
    }
  }

  constructor(options = {}) {
    let error = null;
    try { assertEnvironment(game); } catch (err) { error = err.message; }
    const actors = error ? [] : game.actors.filter(actor => actor.type === "character" && !actor.isToken && !actor.pack);
    const choices = actors.map(actor => `<label style="display:block"><input type="checkbox" name="actors" value="${escapeHtml(actor.id)}"> ${escapeHtml(actor.name)} [${escapeHtml(actor.id)}]</label>`).join("");
    super(orderedExportButtons({
      ...options,
      window: { title: "D&D DM-Dashboard – Charakterexport" },
      content: error ? `<p>${escapeHtml(error)}</p>` : actors.length
        ? `<p>1 bis 50 Charaktere ausdrücklich auswählen. Bestehende Foundry-Daten werden ausschließlich gelesen.</p><div class="form-group"><button type="button" data-selection="all">Alle Charaktere auswählen</button><button type="button" data-selection="none">Auswahl aufheben</button></div><fieldset style="max-height:300px;overflow:auto"><legend>Charaktere</legend>${choices}</fieldset><div class="form-group"><label>Verbindungslink (bei gemerkter Verbindung leer lassen)</label><input name="link" type="text" autocomplete="off" placeholder="Link aus dem Testprogramm einfügen"></div><p>Bei gemerkter Kopplung zuerst im DM-Export-Reiter „Verbinden“ wählen und das Linkfeld leer lassen. Für den Netzwerkabruf unten „Direktübertragung“ wählen. Dabei wird nur diese Auswahl ohne Kampfzuordnung freigegeben. Foundry und das neue Verbindungsfenster offen lassen.</p>`
        : "<p>In dieser Welt ist kein Spielercharakter verfügbar.</p>",
      buttons: [
        ...(!error && actors.length ? [{
          action: "export", label: "JSON-Export", default: true,
          callback: (_event, button) => downloadSelection(selectedIds(button.form))
        }, {
          action: "connect", label: "Direktübertragung",
          callback: (_event, button) => {
            try {
              if (!button.form.elements.link.value.trim()) { selectRememberedCharacters(game,selectedIds(button.form));return; }
              const next = connectCharacter(game, selectedIds(button.form), button.form.elements.link.value, window, message => ui.notifications.error(message));
              replaceConnection(next);
              ui.notifications.info("Verbindungsfenster geöffnet. Dort den Verbindungsstatus prüfen.");
            } catch (error) { ui.notifications.error(error.message); }
          }
        }] : []),
        { action: "cancel", label: "Schließen" }
      ]
    }));
  }
}

export function openExportDialog(DialogClass) {
  if (!game.user?.isGM) { ui.notifications.error('Nur die Spielleitung darf diesen Export öffnen.'); return; }
  return new DialogClass().render({force:true});
}

const exportActions = {
  journals: () => openExportDialog(JournalExportDialog),
  remember: async () => {
    try {
      const answer=await DialogV2.input({window:{title:'Dieses Testprogramm merken'},content:'<p>Einmal im Testprogramm einen Verbindungslink erstellen und hier einfügen. Die Kopplung wird in diesem Browserprofil für diese Welt und Spielleiterkennung gemerkt. Daten müssen anschließend separat freigegeben werden.</p><label>Einmallink<input name="link" autocomplete="off"></label>',ok:{label:'Kopplung ausdrücklich merken'},rejectClose:false});
      if(answer?.link){replaceConnection(null);openRemembered(game,answer.link);}
    }catch(error){ui.notifications.error(error.message);}
  },
  reconnect: () => {try{replaceConnection(null);openRemembered(game);}catch(error){ui.notifications.error(error.message);}},
  disconnect: () => {disconnectRemembered();replaceConnection(null);},
  forget: async () => {try{if(await DialogV2.confirm({window:{title:'Kopplung aufheben'},content:'<p>Gespeichertes Vertrauen widerrufen? Archivdaten bleiben erhalten. Anschließend ist ein neuer Einmallink erforderlich.</p>',yes:{label:'Aufheben'},no:{label:'Abbrechen'},rejectClose:false}))forgetRemembered();}catch(error){ui.notifications.error(error.message);}},
  characters: () => openExportDialog(CharacterExportDialog),
  items: () => openExportDialog(ItemExportDialog),
  monsters: () => openExportDialog(MonsterExportDialog)
};
export class ExportOverviewDialog extends DialogV2 {
  constructor(options = {}) {
    super(orderedExportButtons({...options, window:{title:'DM-Export'}, content:overviewContent(game.user?.isGM), buttons:[{action:'close',label:'Schließen'}]}));
  }
  async _onRender(context, options) {
    await super._onRender(context, options);
    bindOverview(this.element, game, exportActions);
  }
}

Hooks.once("init", () => {
  game.settings.registerMenu(MODULE_ID,"journalExport",{name:"Welt-Journal exportieren",label:"Journalexport öffnen",hint:"Ein Welt-Journal als JSON mit Text- und Bildseiten oder 1–50 Welt-Journals per gemerkter Direktübertragung.",icon:"fa-solid fa-book",type:JournalExportDialog,restricted:true});
  game.settings.registerMenu(MODULE_ID, "itemExport", {name:"Items / Zauber / Charakteroptionen",label:"Einzelexport öffnen",hint:"Genau einen Compendium-Eintrag per gemerkter Verbindung oder als JSON exportieren.",icon:"fa-solid fa-file-export",type:ItemExportDialog,restricted:true});
  if (!registerExportSidebar(globalThis.CONFIG, foundry, game, exportActions)) ui.notifications.warn?.("DM-Export-Reiter nicht registriert. Die Exportmenüs in den Moduleinstellungen bleiben verfügbar.");
  game.settings.registerMenu(MODULE_ID, 'exportOverview', {name:'DM-Export',label:'Exportübersicht öffnen',hint:'Charaktere, Monster und Hinweise zur Verbindung mit dem Testprogramm.',icon:'fa-solid fa-file-export',type:ExportOverviewDialog,restricted:true});
  game.settings.registerMenu(MODULE_ID, "monsterExport", { name: "Ein Monster aus einem Compendium exportieren", label: "Monsterexport öffnen", hint: "Statblock als JSON oder per gekoppeltem Netzwerkabruf. Foundry-Daten bleiben unverändert.", icon: "fa-solid fa-dragon", type: MonsterExportDialog, restricted: true });
  game.settings.registerMenu(MODULE_ID, "characterExport", {
    name: "Ausgewählte Charaktere exportieren", label: "Charakterexport öffnen",
    hint: "Prototyp 0.30.1 für Foundry 14 / D&D5e ab 6.0.3. Neuere ungeprüfte Versionen mit Hinweis. JSON-Download oder Verbindung mit dem lokalen Testprogramm.",
    icon: "fa-solid fa-file-export", type: CharacterExportDialog, restricted: true
  });
});

function selectedIds(form) { return [...form.querySelectorAll('input[name="actors"]:checked')].map(input => input.value); }
export async function downloadSelection(ids) {
  if (ids.length === 1) return downloadCharacter(ids[0]);
  try {
    const now = new Date(), exports = [];
    for (const id of selectedCharacters(game, ids)) exports.push(await exportCharacterWithImages(game, id, null, now));
    const data = {batchVersion:'1.0.0',exports};
    const names = data.exports.map(entry => '<li>' + escapeHtml(entry.character.name) + '</li>').join('');
    if (!await DialogV2.confirm({ window: { title: 'Sammelexport prüfen' }, content: '<p>Diese Charaktere ohne Kampfzuordnung exportieren?</p><ul>' + names + '</ul>', yes: { label: 'JSON herunterladen' }, no: { label: 'Abbrechen' }, rejectClose: false })) return;
    assertEnvironment(game);
    const text = JSON.stringify(data, null, 2);
    if (new TextEncoder().encode(text).length > 3*1024*1024) throw new Error('JSON-Datei überschreitet 3 MB. Bitte weniger Charaktere wählen oder den Netzwerkabruf verwenden.');
    foundry.utils.saveDataToFile(text, 'application/json', 'dnd-characters.json');
  } catch (error) { ui.notifications.error(error.message); }
}






