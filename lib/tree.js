const asciitree = require('ascii-tree');
const chalk = require('chalk');
const { getNodeName, getContentTypeId, getContentId } = require('./contentful');

const getLinkedIds = (node) => {
  const { fields } = node || {};

  const ids = Object.values(fields || {}).flatMap((locales) => {
    return Object.values(locales || {}).flatMap((data) => {
      const getIds = (node) => {
        const { sys } = node;
        const { type, linkType, id } = sys || {};

        if (type === 'Link' && ['Asset', 'Entry'].includes(linkType)) {
          return [id];
        }
        return [];
      };

      if (Array.isArray(data)) {
        return data.flatMap((node) => getIds(node));
      }

      return getIds(data);
    });
  });

  return [...new Set(ids)];
};

const getTree = (node, nodes, level = 1, collected = []) => {
  const { name, links } = node || {};
  const strings = [
    `${''.padStart(level, '#')}${level === 1 ? chalk.green.bold(name) : chalk.cyan(name)}`,
    ...links.flatMap((id) => {
      if (collected.includes(id) || !nodes[id]) {
        return [];
      }

      return getTree(nodes[id], nodes, level + 1, [...collected, ...links]);
    }),
  ];

  return strings.join('\r\n');
};

function buildTree(data) {
  const { entries, assets, contentTypes } = data || {};

  const nodes = [...(entries || []), ...(assets || [])].reduce((nodes, node) => {
    const id = getContentId(node);
    const contentType = (contentTypes || []).find((ct) => getContentId(ct) === getContentTypeId(node));
    const name = getNodeName(node, contentType);
    const links = getLinkedIds(node);

    return {
      ...nodes,
      [id]: { id, name, links },
    };
  }, {});

  const links = Object.values(nodes || {}).flatMap((node) => node.links);
  const rootNodes = Object.values(nodes || {}).filter((node) => !links.includes(node.id));

  const trees = rootNodes.map((node) => {
    const str = getTree(node, nodes);
    return asciitree.generate(str);
  });

  return trees.join('\n\n');
}

module.exports.buildTree = buildTree;
