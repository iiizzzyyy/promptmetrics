import { parseCount, parseCountRow } from '../../../src/utils/pagination';

describe('parseCount', () => {
  it.each([
    [5, 5],
    ['5', 5],
    [BigInt(5), 5],
    ['0', 0],
    ['invalid', 0],
    [null, 0],
    [undefined, 0],
    [{}, 0],
    [[], 0],
    ['', 0],
    ['  7  ', 7],
    [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  ])('parseCount(%p) => %p', (input, expected) => {
    expect(parseCount(input)).toBe(expected);
  });
});

describe('parseCountRow', () => {
  it.each([
    [{ c: 5 }, 5],
    [{ c: '5' }, 5],
    [{ count: 5 }, 5],
    [{ count: '5' }, 5],
    [{ c: null }, 0],
    [null, 0],
    [undefined, 0],
    [{}, 0],
    [{ c: 'invalid', count: 'also invalid' }, 0],
  ])('parseCountRow(%p) => %p', (input, expected) => {
    expect(parseCountRow(input)).toBe(expected);
  });
});
