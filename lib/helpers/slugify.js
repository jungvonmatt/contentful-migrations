const slugify = (text) =>
  text
    .toString()
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-/, '')
    .replace(/-$/, '');

module.exports = { slugify };
