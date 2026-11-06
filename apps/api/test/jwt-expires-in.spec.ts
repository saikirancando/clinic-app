import { parseExpiresIn } from '../src/auth/auth.module';

describe('parseExpiresIn', () => {
  it.each([
    ['8h', '8h'],
    ['1d', '1d'],
    ['30m', '30m'],
    ['3600', 3600],
    ['  8h  ', '8h'],
    ['"8h"', '8h'],
    ["'12h'", '12h'],
  ])('accepts %p', (raw, expected) => {
    expect(parseExpiresIn(raw)).toBe(expected);
  });

  it.each([undefined, '', '   ', '""', 'eight hours', '8 hours later'])(
    'falls back to 8h for %p',
    (raw) => {
      expect(parseExpiresIn(raw)).toBe('8h');
    },
  );
});
