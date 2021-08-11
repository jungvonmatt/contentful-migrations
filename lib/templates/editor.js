const table = require('markdown-table');

const formatValidations = (validations) => {
  let formattedValidation = '';
  for (const validation of validations) {
    formattedValidation = formattedValidation + `\`${JSON.stringify(validation).replace(/\|/g, '&#124;')}\`. `;
  }
  return formattedValidation;
};

const getFieldTable = (fields, editorInterfaces) => {
  const { controls = [] } = editorInterfaces;
  return table([
    ['Name', 'ID', 'Type', 'Required', 'Validations', 'Help text'],
    ...fields.map((field) => {
      const { id, name, type, validations, required } = field;
      const { settings } = controls.find(({ fieldId }) => fieldId === id) || {};
      const { helpText = '' } = settings || {};
      return [name, id, type, required ? '✓' : '', formatValidations(validations), helpText];
    }),
  ]);
};

const createEditorDoc = (contentType, editorInterfaces) => {
  const { fields } = contentType || {};
  return getFieldTable(fields, editorInterfaces);
};

module.exports.createEditorDoc = createEditorDoc;
