/** Coordinates toolbar toggling and origin-scoped website-data removal via the panel
 * controller. It also serializes unknown-error storage across panel windows;
 * filesystem access is explicitly selected and managed by the panel itself. */
import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { installPanelController } from '../features/panel/controller';
import { appendUnknownErrors, validateArchive } from '../features/errors/archive';

export default defineBackground(() => {
  const prepareRead = installPanelController();
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== browser.runtime.id) return;
    // sendResponse + true also supports Chrome 142–147 (Promise replies need 148).
    if (message?.type === 'atlas:prepare-read' || message?.type === 'atlas:reset-clearing') {
      void prepareRead(message.type === 'atlas:reset-clearing').then(sendResponse).catch(() => sendResponse({status: 'failed', completedAt: Date.now(), message: 'Unable to clear the current website data.'}));
      return true;
    }
    if (message?.type === 'atlas:archive-errors') {
      try {validateArchive(message.archive);} catch {sendResponse({error: 'Invalid unknown-error data.'}); return;}
      void appendUnknownErrors(message.archive).then(archive => sendResponse({archive})).catch(() => sendResponse({error: 'Unable to save unknown errors in Chrome. Please retry.'}));
      return true;
    }
  });
});
