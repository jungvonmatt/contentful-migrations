const chalk = require('chalk');
const { diff: deepDiff } = require('deep-diff');
const { stripIndent } = require('common-tags');
const { getContentId, getContentTypeId, getContentName, getEnvironmentId } = require('./contentful');

const getNodeName = (node, contentType) => {
  const { sys } = node || {};
  const { type } = sys || {};
  const { name: contentTypeName, displayField } = contentType || {};

  const name = getContentName(node, displayField);
  return `[${contentTypeName || type}] ${name}`;
};

const getNodeDate = (node) => {
  const { sys } = node || {};
  const { updatedAt } = sys || {};
  const date = new Date(updatedAt);
  const options = { hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: 'numeric' };
  const { locale } = Intl.DateTimeFormat().resolvedOptions();

  return date.toLocaleDateString(locale, options);
};

const diff = (source, dest, contentTypes) => {
  const id = getContentId(dest);
  const contentType = (contentTypes || []).find((ct) => getContentId(ct) === getContentTypeId(dest));
  const { fields: contentTypeFields } = contentType || {};
  const { fields: sourceFields } = source || {};
  const { fields: destFields } = dest || {};
  const diffResult = deepDiff(destFields, sourceFields);

  if (!diffResult) {
    return;
  }

  const name = getNodeName(dest, contentType);

  const changedFields = [
    ...new Set(
      diffResult
        .map((data) => {
          // Kind values
          // N - indicates a newly added property/element
          // D - indicates a property/element was deleted
          // E - indicates a property/element was edited
          // A - indicates a change occurred within an array
          const { path, lhs, rhs, kind, index, item } = data;
          const [fieldId] = path || [];

          if (fieldId) {
            const { name } = (contentTypeFields || []).find(({ id }) => id === fieldId) || {};
            return name || fieldId;
          }
        })
        .filter((v) => v)
    ),
  ];

  const destEnv = getEnvironmentId(dest);
  const sourceEnv = getEnvironmentId(source);

  return {
    type: 'list',
    message: stripIndent`${chalk.reset('Conflict on')} ${chalk.red(name)} (${chalk.reset(
      `${changedFields.join(', ')} changed`
    )}): `,
    name: id,
    choices: [
      {
        name: `[${destEnv} - updated on ${getNodeDate(dest)}] (${chalk.green('skip')})`,
        value: false,
        short: 'skip',
      },
      {
        name: `[${sourceEnv} - updated on ${getNodeDate(source)}] (${chalk.green('overwrite')})`,
        value: true,
        short: 'overwrite',
      },
    ],
  };
};

module.exports.diff = diff;
