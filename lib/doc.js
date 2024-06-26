const path = require('path');
const pc = require('picocolors');
const fs = require('fs-extra');
const Mustache = require('mustache');
const { getEditorInterfaces, getContentTypes, getContentTypeId, getContentId } = require('./contentful');

const getFieldTable = async (fields, editorInterfaces) => {
  const { markdownTable: table } = await import('markdown-table');
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

const createDoc = async (contentType, editorInterfaces) => {
  const { markdownTable: table } = await import('markdown-table');
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

${await getFieldTable(fields, editorInterfaces)}
`;
};

const prepareData = (contentType, editorInterfaces) => {
  const { controls = [] } = editorInterfaces;
  const { fields: fieldsRaw } = contentType || {};

  const fields = (fieldsRaw || []).map((field) => {
    const { id } = field;
    const editorInterface = controls.find(({ fieldId }) => fieldId === id) || {};
    return { ...field, ...editorInterface };
  });

  return { ...contentType, fields };
};

const getCustomRenderer = async (template) => {
  if (template && (template.endsWith('.js') || template.endsWith('.cjs'))) {
    const module = await import(path.resolve(template));
    return (data) => module.default(data);
  } else if (template && template.endsWith('.mustache')) {
    const tpl = await fs.readFile(template, 'utf8');
    return (data) => Mustache.render(tpl, data);
  }
};

/**
 * Create new migration file.
 * Adds initial migration file adding the migration field in the content type
 * @param {Object} config The config object including all required data
 */
const createOfflineDocs = async (config) => {
  console.log('Generating offline docs for content-types ...\n');
  const { directory, template, extension = 'md' } = config || {};
  const contentTypes = await getContentTypes(config);
  const editorInterfaces = await getEditorInterfaces(config);

  const customRender = await getCustomRenderer(template);

  for (let contentType of contentTypes) {
    const interfaces = editorInterfaces.find((node) => getContentTypeId(node) === getContentId(contentType));
    let content = '';

    if (customRender) {
      const data = prepareData(contentType, interfaces);
      content = await customRender(data);
    } else {
      content = await createDoc(contentType, interfaces);
    }

    const filename = `${getContentId(contentType)}.${extension}`;
    const filepath = path.join(directory, filename);
    await fs.outputFile(filepath, content);
    console.log(` - ${pc.green(path.relative(process.cwd(), filepath))}`);
  }

  // await fs.outputFile(filename, content);
  // console.log(`Generated new migration file to ${pc.green(filename)}`);
};

module.exports.createOfflineDocs = createOfflineDocs;
