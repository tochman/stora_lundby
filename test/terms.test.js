import { describe, expect, it } from 'vitest';
import { collectTermOptions, termKey, termLabel } from '../src/utils/terms.js';

describe('termKey / termLabel', () => {
  it('builds a stable composite key and a Swedish display label', () => {
    expect(termKey('2026', 'Höst')).toBe('2026|Höst');
    expect(termLabel('2026', 'Höst')).toBe('Höst 2026');
  });
});

describe('collectTermOptions', () => {
  it('returns one entry per distinct year/term pair, newest first', () => {
    const items = [
      { year: '2026', term: 'Höst' },
      { year: '2026', term: 'Höst' },
      { year: '2027', term: 'Vår' },
      { year: '2026', term: 'Vår' }
    ];
    expect(collectTermOptions(items)).toEqual([
      { year: '2027', term: 'Vår' },
      { year: '2026', term: 'Höst' },
      { year: '2026', term: 'Vår' }
    ]);
  });

  it('excludes entries with no year/term (e.g. standing-role activities)', () => {
    const items = [
      { year: '2026', term: 'Höst' },
      { year: '', term: '' },
      { year: undefined, term: undefined }
    ];
    expect(collectTermOptions(items)).toEqual([{ year: '2026', term: 'Höst' }]);
  });

  it('returns an empty list for no input', () => {
    expect(collectTermOptions([])).toEqual([]);
  });
});
