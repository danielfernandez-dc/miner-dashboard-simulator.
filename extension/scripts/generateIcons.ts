/** Rasterizes the same SVG used by the panel into Chrome's required PNG sizes.
 * The vector is the source of truth; generated icons are never manually edited. */
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {Resvg} from '@resvg/resvg-js';
export async function generateIcons() {
  const source = await readFile(new URL('../public/atlas-mark.svg', import.meta.url), 'utf8');
  await mkdir(new URL('../public/icons/', import.meta.url), {recursive:true});
  for (const size of [16,32,48,128]) {
    const png = new Resvg(source, {fitTo:{mode:'width',value:size}}).render().asPng();
    await writeFile(new URL(`../public/icons/atlas-${size}.png`, import.meta.url), png);
  }
}
