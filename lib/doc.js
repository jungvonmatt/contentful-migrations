const path = require('path');
const chalk = require('chalk');
const fs = require('fs-extra');
const { getEditorInterfaces, getContentTypes, getContentTypeId, getContentId } = require('./contentful');
const { createApiDoc } = require('./templates/api');
const { createEditorDoc } = require('./templates/editor');

/**
 * Create offline docs
 * @param {Object} config The config object including all required data
 */
const createOfflineDocs = async (config) => {
  console.log('Generating offline docs for content-types ...\n');
  const { directory, template } = config || {};
  const contentTypes = await getContentTypes(config);
  const editorInterfaces = await getEditorInterfaces(config);

  for (let contentType of contentTypes) {
    const interfaces = editorInterfaces.find((node) => getContentTypeId(node) === getContentId(contentType));
    let content = '';
    if (template === 'editor') {
      content = createEditorDoc(contentType, interfaces);
    } else {
      content = createApiDoc(contentType, interfaces);
    }
    const filename = `${getContentId(contentType)}.md`;
    const filepath = path.join(directory, filename);
    await fs.outputFile(filepath, content);
    console.log(` - ${chalk.green(path.relative(process.cwd(), filepath))}`);
  }
};

module.exports.createOfflineDocs = createOfflineDocs;
