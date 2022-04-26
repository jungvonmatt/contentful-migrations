const { addOrdered, addValues, unique } = require('./validation.utils');

describe('unique', () => {
  it('should remove duplicates', async () => {
    expect(unique(['foo', 'bar', 'foo', 'baz', 'bar'])).toEqual(['foo', 'bar', 'baz']);
  });
});

describe('addOrdered', () => {
  const a1 = ['foo', 'bar'];
  const a2 = ['baz', 'bar', 'bat'];

  it('should add unique values and order the list', async () => {
    expect(addOrdered(a1, a2)).toEqual(['bar', 'bat', 'baz', 'foo']);
  });
});

describe('addValues', () => {
  const a1 = ['foo', 'bar', 'test'];
  const a2 = ['baz', 'bar', 'bat'];

  it('should add values sorted', async () => {
    expect(addValues(a1, a2, { mode: 'sorted' })).toEqual(['bar', 'bat', 'baz', 'foo', 'test']);
  });

  it('should add values at start', async () => {
    expect(addValues(a1, a2, { mode: 'start' })).toEqual(['baz', 'bar', 'bat', 'foo', 'test']);
  });

  it('should add values at end', async () => {
    expect(addValues(a1, a2, { mode: 'end' })).toEqual(['foo', 'bar', 'test', 'baz', 'bat']);
  });

  it('should add values before', async () => {
    expect(addValues(a1, a2, { mode: 'before', ref: 'bar' })).toEqual(['foo', 'baz', 'bar', 'bat', 'test']);
  });

  it('should add values before fallback', async () => {
    expect(addValues(a1, a2, { mode: 'before', ref: 'unknown' })).toEqual(['foo', 'bar', 'test', 'baz', 'bat']);
  });

  it('should add values after', async () => {
    expect(addValues(a1, a2, { mode: 'after', ref: 'bar' })).toEqual(['foo', 'bar', 'baz', 'bat', 'test']);
  });
});
