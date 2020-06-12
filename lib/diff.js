const Diff = require('diff');
const { documentToPlainTextString } = require('@contentful/rich-text-plain-text-renderer');
const chalk = require('chalk');
const { diff: deepDiff } = require('deep-diff');
const { stripIndent } = require('common-tags');
const {
  getContentId,
  getContentTypeId,
  getContentName,
  getEnvironmentId,
  TYPE_SYMBOL,
  TYPE_TEXT,
  TYPE_RICHTEXT,
  TYPE_NUMBER,
  TYPE_DATE,
  TYPE_LOCATION,
  TYPE_ARRAY,
  TYPE_BOOLEAN,
  TYPE_LINK,
  LINK_TYPE_ASSET,
  LINK_TYPE_ENTRY,
} = require('./contentful');

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

const diffString = (source, dest) => {
  const diff = Diff.diffChars(source, dest);
  const parts = diff.map((part) => {
    // green for additions, red for deletions
    // grey for common parts
    const color = part.added ? 'green' : part.removed ? 'red' : 'grey';

    // Todo: truncate grey text

    return chalk[color](part.value);
  });

  return parts.join('');
};

const getField = (fieldId, contentType) => {
  const { fields } = contentType || {};
  const field = (fields || []).find(({ id } = {}) => id === fieldId);
  return field || {};
};

const getFieldValue = (fieldId, node) => {
  const { fields } = node || {};
  const { [fieldId]: field } = fields || {};
  const [value] = Object.values(field || {}) || [];
  return value;
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
  // console.log(contentType);
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
            const { name = fieldId } = (contentTypeFields || []).find(({ id }) => id === fieldId) || {};
            const field = getField(fieldId, contentType);
            const { type, linkType } = field || {};
            const prev = getFieldValue(fieldId, source);
            const next = getFieldValue(fieldId, dest);
            if (type === TYPE_SYMBOL) {
              return `${chalk.bold(name)}: ${chalk.reset(diffString(`${prev || ''}`, `${next || ''}`))}`;
            }
            if (type === TYPE_RICHTEXT) {
              return `${chalk.bold(name)}: ${chalk.reset(
                diffString(documentToPlainTextString(prev || {}), documentToPlainTextString(next || {}))
              )}`;
            }
            if (type === TYPE_NUMBER) {
              return `${chalk.bold(name)}: ${chalk.reset(diffString(`${prev || ''}`, `${next || ''}`))}`;
            }
            if (type === TYPE_TEXT) {
              return `${chalk.bold(name)}: ${chalk.reset(diffString(`${prev || ''}`, `${next || ''}`))}`;
            }
            if (type === TYPE_DATE) {
              return `${chalk.bold(name)}: ${chalk.reset.red(`${prev || ''}`)} ${chalk.reset.green(`${next || ''}`)}`;
            }
            if (type === TYPE_LOCATION) {
              return `${chalk.bold(name)}: ${chalk.reset.red(`${JSON.stringify(prev || '')}`)} ${chalk.reset.green(
                `${JSON.stringify(next || '')}`
              )}`;
            }
            if (type === TYPE_BOOLEAN) {
              return `${chalk.bold(name)}: ${chalk.reset.red(`${JSON.stringify(prev)}`)} ${chalk.reset.green(
                `${JSON.stringify(next)}`
              )}`;
            }

            return name;
          }
        })
        .filter((v) => v)
    ),
  ];

  const destEnv = getEnvironmentId(dest);
  const sourceEnv = getEnvironmentId(source);

  return {
    type: 'list',
    message: `${chalk.reset('Conflict on')} ${chalk.red(name)}\n  ${chalk.reset(`${changedFields.join('\n  ')}`)}\n`,

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
