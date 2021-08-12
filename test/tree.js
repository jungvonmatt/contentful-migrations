import fs from 'fs-extra';
import { buildTree } from '../lib/tree';

(async () => {
  const data = await fs.readJson(new URL('/fixtures/treeData.json', import.meta.url));
  const { contentTypes, entries, assets } = data;
  const tree = buildTree({ contentTypes, assets, entries });

  console.log(tree);
})();
