/** Connects Chrome's toolbar button to the Atlas panel. It does not read pages,
 * change miner settings, or keep diagnostic state in the background worker. */
import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});
