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

const oldValueColor = (text) => chalk.reset.redBright.dim(text);
const newValueColor = (text) => chalk.reset.green(text);
const unchangedColor = (text) => chalk.reset.grey(text);

const diffString = (source, dest) => {
  const diff = Diff.diffWords(source, dest);
  const parts = diff.map((part) => {
    if (part.added) {
      return newValueColor(part.value);
    }

    if (part.removed) {
      return oldValueColor(part.value);
    }

    if (part.value.length > 50) {
      const value = `${part.value.slice(0, 15)} [...] ${part.value.slice(-15)}`;
      return unchangedColor(chalk.grey(value));
    }

    return unchangedColor(part.value);
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

const normalizeArray = (array) =>
  (array || []).map((val) => {
    if (typeof val === 'string') {
      return val;
    }

    const { sys } = val || {};
    const { id, linkType } = sys || {};
    return `${id} (${linkType})`;
  });

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
      return `${chalk.bold(name)}: ${chalk.reset(diffString(`${destValue || ''}`, `${sourceValue || ''}`))}`;
    }
    if (type === TYPE_RICHTEXT) {
      return `${chalk.bold(name)}: ${chalk.reset(
        diffString(documentToPlainTextString(destValue || {}), documentToPlainTextString(sourceValue || {}))
      )}`;
    }
    if (type === TYPE_NUMBER) {
      // return `${chalk.bold(name)}: ${chalk.reset(diffString(`${sourceValue || ''}`, `${destValue || ''}`))}`;
      return `${chalk.bold(name)}: ${oldValueColor(`${destValue}`)} ${newValueColor(`${sourceValue}`)}`;
    }
    if (type === TYPE_TEXT) {
      return `${chalk.bold(name)}: ${chalk.reset(diffString(`${destValue || ''}`, `${sourceValue || ''}`))}`;
    }
    if (type === TYPE_DATE) {
      return `${chalk.bold(name)}: ${oldValueColor(`${destValue || ''}`)} ${newValueColor(`${sourceValue || ''}`)}`;
    }
    if (type === TYPE_LOCATION) {
      return `${chalk.bold(name)}: ${oldValueColor(`${JSON.stringify(destValue || '')}`)} ${newValueColor(
        `${JSON.stringify(sourceValue || '')}`
      )}`;
    }
    if (type === TYPE_BOOLEAN) {
      return `${chalk.bold(name)}: ${oldValueColor(`${JSON.stringify(destValue)}`)} ${newValueColor(
        `${JSON.stringify(sourceValue)}`
      )}`;
    }
    if (type === TYPE_LINK) {
      const sourceValueId = getContentId(sourceValue || {});
      const destValueId = getContentId(destValue || {});
      return `${chalk.bold(name)} (${linkType}):  ${oldValueColor(destValueId || 'deleted')} ${newValueColor(
        sourceValueId || 'empty'
      )}`;
    }

    if (type === TYPE_ARRAY) {
      // Kind values
      // N - indicates a newly added property/element
      // D - indicates a property/element was deleted
      // E - indicates a property/element was edited
      // A - indicates a change occurred within an array
      // const changes = deepDiff(sourceValue, destValue);
      const sourceArray = normalizeArray(sourceValue);
      const destArray = normalizeArray(destValue);

      const array = Array(Math.max(sourceArray.length, destArray.length))
        .fill('')
        .map((_, index) => {
          if (sourceArray[index] === destArray[index]) {
            return unchangedColor(sourceArray[index]);
          }

          if (sourceArray[index] && destArray[index]) {
            return `${oldValueColor(destArray[index] || '')} ${newValueColor(sourceArray[index])}`;
          }

          if (destArray[index]) {
            return `${newValueColor(sourceArray[index])}`;
          }

          return `${oldValueColor(destArray[index] || '')}`;
        });

      return `${chalk.bold(name)}: [\n    ${array.join('\n    ')}\n  ]`;
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
        name: `Use ${oldValueColor(destEnv)} - updated on ${getNodeDate(dest)} ${chalk.bold('(skip)')}`,
        value: false,
        short: 'skip',
      },
      {
        name: `Use ${newValueColor(sourceEnv)} - updated on ${getNodeDate(source)} ${chalk.bold('(overwrite)')}`,
        value: true,
        short: 'overwrite',
      },
    ],
  };
};

module.exports.diff = diff;
