const { diff } = require('./diff');

const richText = (value) => ({
  nodeType: 'document',
  data: {},
  content: [
    {
      nodeType: 'paragraph',
      data: {},
      content: [
        {
          nodeType: 'text',
          value,
          marks: [],
          data: {},
        },
      ],
    },
  ],
});

const createEntry = (id, environmentId, fields) => ({
  sys: {
    id,
    type: 'Entry',
    environment: {
      sys: {
        id: environmentId,
      },
    },
    contentType: {
      sys: {
        id: 'article',
      },
    },
    updatedAt: '2026-04-14T12:00:00.000Z',
  },
  fields,
});

describe('diff', () => {
  const contentTypes = [
    {
      sys: { id: 'article' },
      name: 'Article',
      displayField: 'title',
      fields: [
        { id: 'title', name: 'Title', type: 'Symbol' },
        { id: 'body', name: 'Body', type: 'Text' },
        { id: 'summary', name: 'Summary', type: 'RichText' },
        { id: 'count', name: 'Count', type: 'Integer' },
        { id: 'publishDate', name: 'Publish date', type: 'Date' },
        { id: 'location', name: 'Location', type: 'Location' },
        { id: 'featured', name: 'Featured', type: 'Boolean' },
        { id: 'author', name: 'Author', type: 'Link', linkType: 'Entry' },
        { id: 'gallery', name: 'Gallery', type: 'Array', items: { linkType: 'Asset' } },
      ],
    },
  ];

  it('returns nothing when two nodes are identical', () => {
    const entry = createEntry('entry-1', 'master', {
      title: { 'en-US': 'Same title' },
    });

    expect(diff(entry, entry, contentTypes)).toBeUndefined();
  });

  it('builds a conflict prompt for changed fields across supported field types', () => {
    const source = createEntry('entry-1', 'preview', {
      title: { 'en-US': 'New title' },
      body: { 'en-US': 'Updated body copy' },
      summary: { 'en-US': richText('Fresh summary') },
      count: { 'en-US': 10 },
      publishDate: { 'en-US': '2026-04-15' },
      location: { 'en-US': { lat: 53.5, lon: 10 } },
      featured: { 'en-US': true },
      author: {
        'en-US': {
          sys: {
            type: 'Link',
            linkType: 'Entry',
            id: 'author-2',
          },
        },
      },
      gallery: {
        'en-US': [
          {
            sys: {
              type: 'Link',
              linkType: 'Asset',
              id: 'asset-1',
            },
          },
          {
            sys: {
              type: 'Link',
              linkType: 'Asset',
              id: 'asset-2',
            },
          },
        ],
      },
    });
    const dest = createEntry('entry-1', 'master', {
      title: { 'en-US': 'Old title' },
      body: { 'en-US': 'Old body copy' },
      summary: { 'en-US': richText('Old summary') },
      count: { 'en-US': 5 },
      publishDate: { 'en-US': '2026-04-10' },
      location: { 'en-US': { lat: 52.5, lon: 13.4 } },
      featured: { 'en-US': false },
      author: {
        'en-US': {
          sys: {
            type: 'Link',
            linkType: 'Entry',
            id: 'author-1',
          },
        },
      },
      gallery: {
        'en-US': [
          {
            sys: {
              type: 'Link',
              linkType: 'Asset',
              id: 'asset-1',
            },
          },
        ],
      },
    });

    const result = diff(source, dest, contentTypes);

    expect(result).toMatchObject({
      type: 'list',
      name: 'entry-1',
    });
    expect(result.message).toContain('Conflict on');
    expect(result.message).toContain('Title');
    expect(result.message).toContain('Body');
    expect(result.message).toContain('Summary');
    expect(result.message).toContain('Count');
    expect(result.message).toContain('Publish date');
    expect(result.message).toContain('Location');
    expect(result.message).toContain('Featured');
    expect(result.message).toContain('Author');
    expect(result.message).toContain('Gallery');
    expect(result.choices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: false, short: 'skip' }),
        expect.objectContaining({ value: true, short: 'overwrite' }),
      ])
    );
    expect(result.choices[0].name).toContain('master');
    expect(result.choices[1].name).toContain('preview');
  });
});
