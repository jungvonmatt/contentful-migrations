const table = require('markdown-table');

const getFieldTable = (fields, editorInterfaces) => {
  const { controls = [] } = editorInterfaces;
  return table([
    ['Id', 'Name', 'Type', 'Required', 'Localized', 'HelpText', 'Remarks'],
    ...fields.map((field) => {
      const { id, name, type, localized, required, items } = field;
      const { settings } = controls.find(({ fieldId }) => fieldId === id) || {};
      const { linkType } = items || {};
      const { helpText = '' } = settings || {};
      return [
        id,
        name,
        linkType ? `${type}<${linkType}>` : type,
        required ? '✓' : '✗',
        localized ? '✓' : '✗',
        helpText,
        '',
      ];
    }),
  ]);
};

const createApiDoc = (contentType, editorInterfaces) => {
  const { name, displayField, description, sys, fields } = contentType || {};
  const { id } = sys || {};

return `
${name}
-------

## Common Properties

${table([
  ['Property', 'Value'],
  ['**Name:**', name],
  ['**ID:**', id],
  ['**DisplayField:**', displayField],
])}

## Description

${description}

## Fields

${getFieldTable(fields, editorInterfaces)}
`;
};

module.exports.createApiDoc = createApiDoc;
