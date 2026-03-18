const { slugify } = require('./slugify');

describe('slugify', () => {
  it('converts spaces to hyphens and lowercases', () => {
    expect(slugify('Add this new feature')).toBe('add-this-new-feature');
  });

  it('removes special characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });

  it('trims leading and trailing whitespace', () => {
    expect(slugify('  spaced  out  ')).toBe('spaced-out');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello');
  });

  it('collapses consecutive special characters into a single hyphen', () => {
    expect(slugify('foo---bar   baz')).toBe('foo-bar-baz');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(slugify('   ')).toBe('');
  });

  it('returns empty string for invalid string input', () => {
    expect(slugify('')).toBe('');
    expect(slugify('-')).toBe('');
    expect(slugify('%/&((§/')).toBe('');
  });

  it('preserves numbers', () => {
    expect(slugify('Version 2 update')).toBe('version-2-update');
  });

  it('handles colons and mixed punctuation', () => {
    expect(slugify('Fix: content model!')).toBe('fix-content-model');
  });

  it('handles leading and trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello');
  });

  it('handles underscores', () => {
    expect(slugify('_create_user')).toBe('create-user');
  });

  it('handles camel case', () => {
    expect(slugify('pArticle')).toBe('p-article');
    expect(slugify('Create pArticle ContentType')).toBe('create-p-article-content-type');
  });
});
