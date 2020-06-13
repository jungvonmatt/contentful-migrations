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
    const color = part.added ? 'red' : part.removed ? 'green' : 'grey';

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

  const changedFields = [
    ...new Set(
      diffResult
        .map((data) => {
          const { path } = data;
          const [fieldId] = path || [];
          return fieldId;
        })
        .filter((v) => v)
    ),
  ];

  // console.log(contentType);
  const fieldData = changedFields.map((fieldId) => {
    const { name = fieldId } = (contentTypeFields || []).find(({ id }) => id === fieldId) || {};
    const field = getField(fieldId, contentType);
    const { type, linkType } = field || {};
    const sourceValue = getFieldValue(fieldId, source);
    const destValue = getFieldValue(fieldId, dest);
    if (type === TYPE_SYMBOL) {
      return `${chalk.bold(name)}: ${chalk.reset(diffString(`${sourceValue || ''}`, `${destValue || ''}`))}`;
    }
    if (type === TYPE_RICHTEXT) {
      return `${chalk.bold(name)}: ${chalk.reset(
        diffString(documentToPlainTextString(sourceValue || {}), documentToPlainTextString(destValue || {}))
      )}`;
    }
    if (type === TYPE_NUMBER) {
      // return `${chalk.bold(name)}: ${chalk.reset(diffString(`${sourceValue || ''}`, `${destValue || ''}`))}`;
      return `${chalk.bold(name)}: ${chalk.reset.green(`${sourceValue}`)} ${chalk.reset.red(`${destValue}`)}`;
    }
    if (type === TYPE_TEXT) {
      return `${chalk.bold(name)}: ${chalk.reset(diffString(`${sourceValue || ''}`, `${destValue || ''}`))}`;
    }
    if (type === TYPE_DATE) {
      return `${chalk.bold(name)}: ${chalk.reset.green(`${sourceValue || ''}`)} ${chalk.reset.red(
        `${destValue || ''}`
      )}`;
    }
    if (type === TYPE_LOCATION) {
      return `${chalk.bold(name)}:${chalk.reset.green(`${JSON.stringify(sourceValue || '')}`)} ${chalk.reset.red(
        `${JSON.stringify(destValue || '')}`
      )} `;
    }
    if (type === TYPE_BOOLEAN) {
      return `${chalk.bold(name)}: ${chalk.reset.green(`${JSON.stringify(sourceValue)}`)} ${chalk.reset.red(
        `${JSON.stringify(destValue)}`
      )}`;
    }
    if (type === TYPE_LINK) {
      const sourceValueId = getContentId(sourceValue || {});
      const destValueId = getContentId(destValue || {});
      return `${chalk.bold(name)} (${linkType}): ${chalk.reset.green(sourceValueId || 'deleted')}  ${chalk.reset.red(
        destValueId || 'deleted'
      )}`;
    }

    if (type === TYPE_ARRAY) {
      // Kind values
      // N - indicates a newly added property/element
      // D - indicates a property/element was deleted
      // E - indicates a property/element was edited
      // A - indicates a change occurred within an array
      const changes = deepDiff(sourceValue, destValue);

      console.log({ changes, sourceValue, destValue });
      return name;
    }

    return name;
  });

  const destEnv = getEnvironmentId(dest);
  const sourceEnv = getEnvironmentId(source);

  return {
    type: 'list',
    message: `${chalk.reset('Conflict on')} ${chalk.cyan(name)}\n  ${chalk.reset(`${fieldData.join('\n  ')}`)}\n`,

    name: id,
    choices: [
      {
        name: `[Environment ${chalk.green(destEnv)} - updated on ${getNodeDate(dest)}] (skip)`,
        value: false,
        short: 'skip',
      },
      {
        name: `[Environment ${chalk.red(sourceEnv)} - updated on ${getNodeDate(source)}] (overwrite)`,
        value: true,
        short: 'overwrite',
      },
    ],
  };
};

module.exports.diff = diff;
