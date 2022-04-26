/**
 * Returns a new array containing only the unique values of the given array.
 * The given order of the elements is kept.
 * If duplicates exist the first occurrence is kept and the others are removed.
 */
const unique = (array) => [...new Set(array)];

/**
 * Returns an array with the unique items of both arrays sorted by natural ordering.
 * @param {Array} array1
 * @param {Array} array2
 */
const addOrdered = (array1, array2) => {
  const result = [...new Set([...array1, ...array2])];
  result.sort();
  return result;
};

const ADD_MODE_SORTED = 'sorted';
const ADD_MODE_START = 'start';
const ADD_MODE_END = 'end';
const ADD_MODE_BEFORE = 'before';
const ADD_MODE_AFTER = 'after'; // default

/**
 * Get the insert position depending on the options.
 * @param {string[]} array The array where values should be added.
 * @param {string} options.mode The mode how to add the values (sorted, start, end, before, after)
 * @param {string|undefined} options.ref The reference value for mode "before" and "after"
 * @returns {number}
 */
const getInsertPosition = (array, options = {}) => {
  if (options.mode === ADD_MODE_START) {
    return 0;
  }
  if (options.mode === ADD_MODE_END) {
    return array.length;
  }

  let refIndex = array.indexOf(options.ref);
  if (refIndex >= 0) {
    if (options.mode === ADD_MODE_BEFORE) {
      return refIndex;
    }
    if (options.mode === ADD_MODE_AFTER) {
      return refIndex + 1;
    }
  }

  // default at the end
  return array.length;
};

/**
 * Adds values to a string array depending on the specified mode.
 * The result list always contains unique values by calling the unique function.
 * @param {string[]} array The array where values should be added.
 * @param {string[]} toAdd The list of values to add.
 * @param {string} options.mode The mode how to add the values (sorted, start, end, before, after)
 * @param {string|undefined} options.ref The reference value for mode "before" and "after"
 * @returns {string[]}
 */
const addValues = (array, toAdd, options = {}) => {
  if (options.mode === ADD_MODE_SORTED) {
    return addOrdered(array, toAdd);
  }

  let position = getInsertPosition(array, options);
  return unique([...array.slice(0, position), ...toAdd, ...array.slice(position)]);
};

module.exports = {
  addOrdered,
  addValues,
  unique,
};
