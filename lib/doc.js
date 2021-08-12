import path from 'path';
import table from 'markdown-table';
import chalk from 'chalk';
import fs from 'fs-extra';
import { getEditorInterfaces, getContentTypes, getContentTypeId, getContentId } from './contentful.js';

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

const createDoc = (contentType, editorInterfaces) => {
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

/**
 * Create new migration file.
 * Adds initial migration file adding the migration field in the content type
 * @param {Object} config The config object including all required data
 */
export const createOfflineDocs = async (config) => {
  console.log('Generating offline docs for content-types ...\n');
  const { directory } = config || {};
  const contentTypes = await getContentTypes(config);
  const editorInterfaces = await getEditorInterfaces(config);

  for (let contentType of contentTypes) {
    const interfaces = editorInterfaces.find((node) => getContentTypeId(node) === getContentId(contentType));
    const content = createDoc(contentType, interfaces);
    const filename = `${getContentId(contentType)}.md`;
    const filepath = path.join(directory, filename);
    await fs.outputFile(filepath, content);
    console.log(` - ${chalk.green(path.relative(process.cwd(), filepath))}`);
  }

  // await fs.outputFile(filename, content);
  // console.log(`Generated new migration file to ${chalk.green(filename)}`);
};
