/** Builds the Atlas extension with React and Tailwind. The simulator remains a
 * separate static site; only the shared troubleshooting JSON is copied here. */
import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import {generateIcons} from './scripts/generateIcons';
import { copyFile, mkdir } from 'node:fs/promises';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  hooks: {
    'build:before': async () => {
      await generateIcons();
      await mkdir(new URL('./public/', import.meta.url), { recursive: true });
      await copyFile(new URL('../public/miner-error-rules.json', import.meta.url), new URL('./public/miner-error-rules.json', import.meta.url));
    },
  },
  manifest: {
    name: 'Atlas · Miner troubleshooting',
    description: 'Read simulator miner logs and find the next troubleshooting steps locally.',
    minimum_chrome_version: '142',
    permissions: ['sidePanel', 'storage', 'activeTab', 'scripting', 'browsingData', 'cookies'],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    icons: {16:'icons/atlas-16.png',32:'icons/atlas-32.png',48:'icons/atlas-48.png',128:'icons/atlas-128.png'},
    action: {default_title:'Open Atlas', default_icon:{16:'icons/atlas-16.png',32:'icons/atlas-32.png'}},
  },
});
