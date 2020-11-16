const path = require('path');
const fs = require('fs-extra');
const { buildTree } = require('../lib/tree');

(async () => {
  const data = await fs.readJson(path.join(__dirname, '/fixtures/treeData.json'));
  const { contentTypes, entries, assets } = data;
  const tree = buildTree({ contentTypes, assets, entries });

  console.log(tree);
})();
