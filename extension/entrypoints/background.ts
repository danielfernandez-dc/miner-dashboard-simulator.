/** Opens Atlas directly from Chrome's action click, which grants temporary page
 * access. The click handler opens synchronously to preserve the required gesture;
 * diagnostic data remains inside the panel rather than the service worker. */
import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {
  // Handle the action explicitly so opening the panel also grants activeTab.
  void browser.sidePanel.setPanelBehavior({openPanelOnActionClick: false});
  browser.action.onClicked.addListener(tab => {
    if (tab.id === undefined) return;
    void browser.sidePanel.open({tabId: tab.id}).catch(console.error);
  });
});
