import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { vi } from 'vitest';
import { loadCjsModule } from '../test-utils/load-cjs-module.mjs';

const makeTempDir = async () => fs.mkdtemp(path.join(os.tmpdir(), 'contentful-docs-'));

describe('createOfflineDocs', () => {
  const contentType = {
    sys: { id: 'article' },
    name: 'Article',
    displayField: 'title',
    description: 'Documentation for article fields',
    fields: [
      {
        id: 'title',
        name: 'Title',
        type: 'Symbol',
        localized: false,
        required: true,
      },
      {
        id: 'hero',
        name: 'Hero',
        type: 'Array',
        localized: false,
        required: false,
        items: {
          linkType: 'Asset',
        },
      },
    ],
  };
  const editorInterface = {
    sys: {
      contentType: {
        sys: {
          id: 'article',
        },
      },
    },
    controls: [
      {
        fieldId: 'title',
        settings: {
          helpText: 'Shown in listings',
        },
      },
    ],
  };

  let getEditorInterfaces;
  let getContentTypes;
  let createOfflineDocs;

  beforeEach(() => {
    vi.clearAllMocks();
    getContentTypes = vi.fn().mockResolvedValue([contentType]);
    getEditorInterfaces = vi.fn().mockResolvedValue([editorInterface]);
    ({ createOfflineDocs } = loadCjsModule('./lib/doc.js', {
      './contentful': {
        getEditorInterfaces,
        getContentTypes,
        getContentTypeId: vi.fn((node) => node?.sys?.contentType?.sys?.id || node?.sys?.id),
        getContentId: vi.fn((node) => node?.sys?.id),
      },
    }));
  });

  it('creates markdown docs with the default renderer', async () => {
    const directory = await makeTempDir();

    await createOfflineDocs({ directory });

    const doc = await fs.readFile(path.join(directory, 'article.md'), 'utf8');
    expect(doc).toContain('Article');
    expect(doc).toContain('## Common Properties');
    expect(doc).toContain('Documentation for article fields');
    expect(doc).toContain('Shown in listings');
    expect(doc).toContain('Array<Asset>');
  });

  it('supports custom JavaScript template renderers', async () => {
    const directory = await makeTempDir();
    const template = path.join(directory, 'render-doc.cjs');
    await fs.writeFile(
      template,
      "module.exports = (data) => `custom:${data.sys.id}:${data.fields.map((field) => field.id).join(',')}`;\n",
    );

    await createOfflineDocs({ directory, template, extension: 'txt' });

    const doc = await fs.readFile(path.join(directory, 'article.txt'), 'utf8');
    expect(doc).toBe('custom:article:title,hero');
  });

  it('supports custom Mustache template renderers', async () => {
    const directory = await makeTempDir();
    const template = path.join(directory, 'render-doc.mustache');
    await fs.writeFile(template, '{{name}} => {{#fields}}{{id}} {{/fields}}');

    await createOfflineDocs({ directory, template });

    const doc = await fs.readFile(path.join(directory, 'article.md'), 'utf8');
    expect(doc.trim()).toBe('Article => title hero');
  });
});
