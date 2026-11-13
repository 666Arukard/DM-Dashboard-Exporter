import {rememberedSummary} from './remembered-connection.mjs';
import { connectionSummary } from './network.mjs';

export const TAB_ID = 'dndDmExport';

export function overviewContent(isGM) {
  if (!isGM) return '<p>Nur die Spielleitung darf diesen Export öffnen.</p>';
  return `<div style="padding:12px;overflow:auto"><h2>DM-Export</h2><p data-export-version></p>
    <p>Charaktere, Monster, Gegenstände, Zauber und Charakteroptionen für dein lokales DM-Dashboard auswählen. Beim Öffnen wird noch nichts übertragen.</p>
    <div style="display:flex;gap:8px;flex-direction:column"><button type="button" data-export-open="characters">Charaktere auswählen</button><button type="button" data-export-open="monsters">Monster auswählen</button><button type="button" data-export-open="journals">Journal auswählen</button><button type="button" data-export-open="items">Items / Zauber / Charakteroptionen</button></div>
    <p>Einzelne Gegenstände, Zauber und Charakteroptionen über die gemerkte Verbindung abrufen oder als JSON herunterladen.</p><h3>Direktübertragung</h3><div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" data-export-open="remember">Kopplung merken</button><button type="button" data-export-open="reconnect">Verbinden</button><button type="button" data-export-open="disconnect">Trennen</button><button type="button" data-export-open="forget">Kopplung aufheben</button></div><p data-export-status role="status"></p><button type="button" data-export-refresh>Status aktualisieren</button>
    <p>1. Testprogramm auf Windows starten und dort einen Verbindungslink erstellen.</p>
    <p>2. Charaktere oder Monster auswählen und den Link dort einfügen.</p>
    <p>3. Abruf im Testprogramm starten.</p>
<p>Optional einmal „Kopplung merken“ verwenden. Danach „Verbinden“ und in der Auswahl das Linkfeld leer lassen. Nach einer Wiederverbindung die Auswahl erneut freigeben. Foundry und Verbindungsfenster bleiben erforderlich.</p>
    <p>Die bisherigen Exportzugänge bleiben auch in den Moduleinstellungen verfügbar.</p></div>`;
}

export function bindOverview(root, game, actions) {
  const refresh = () => {
    const version = root.querySelector('[data-export-version]');
    if (version) version.textContent = 'Modulversion: ' + (game.modules?.get('dnd-dm-exporter')?.version ?? 'nicht verfügbar');
    const status = root.querySelector('[data-export-status]');
    if (status) status.textContent = game.user?.isGM ? (rememberedSummary(game) ?? connectionSummary()) : 'Nur für die Spielleitung verfügbar.';
  };
  for (const button of root.querySelectorAll('[data-export-open]')) {
    button.onclick = () => { if (game.user?.isGM) return actions[button.dataset.exportOpen]?.(); };
  }
  const button = root.querySelector('[data-export-refresh]');
  if (button) button.onclick = refresh;
  refresh();
  if(globalThis.document?.addEventListener){
    root._dndStatusCleanup?.();
    const update=()=>{if(root.isConnected===false){root._dndStatusCleanup?.();return;}refresh();};
    document.addEventListener('dnd-dm-connection-change',update);
    root._dndStatusCleanup=()=>document.removeEventListener('dnd-dm-connection-change',update);
  }
}

export function createExportSidebarClass(Base, game, actions) {
  return class ExportSidebar extends Base {
    static tabName = TAB_ID;
    static DEFAULT_OPTIONS = { id: TAB_ID, window: {title:'DM-Export'}, classes:['dnd-dm-export-sidebar'] };
    _canRender(options) {
      if (!game.user?.isGM) return false;
      return super._canRender(options);
    }
    async _renderHTML() {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = overviewContent(game.user?.isGM);
      return wrapper;
    }
    _replaceHTML(result, content) { content.replaceChildren(result); }
    async _onRender(context, options) {
      await super._onRender(context, options);
      bindOverview(this.element, game, actions);
    }
  };
}

/** Native Sidebar-Registrierung, kein Eingriff in DOM oder Werkzeugleiste. */
export function registerExportSidebar(config, foundry, game, actions) {
  const Base = foundry.applications.sidebar?.AbstractSidebarTab;
  if (Number(game.release?.generation) !== 14 || !Base || !config?.ui?.sidebar?.TABS) return false;
  if (config.ui[TAB_ID] || config.ui.sidebar.TABS[TAB_ID]) return false;
  config.ui[TAB_ID] = createExportSidebarClass(Base, game, actions);
  const tabs = config.ui.sidebar.TABS;
  const descriptor = {tooltip:'DM-Export',icon:'fa-solid fa-file-export',gmOnly:true};
  // Die Reihenfolge des Records bestimmt die Reiterfolge. Vor Einstellungen einfügen.
  const entries = Object.entries(tabs);
  const index = entries.findIndex(([name]) => name === 'settings');
  entries.splice(index < 0 ? entries.length : index, 0, [TAB_ID, descriptor]);
  config.ui.sidebar.TABS = Object.fromEntries(entries);
  return true;
}

