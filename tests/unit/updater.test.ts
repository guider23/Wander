import { describe, it, expect } from 'vitest';
import { isVersionGreater } from '../../src/utils/updater';

describe('Updater - Semver comparison', () => {
  it('correctly compares semantic versions with and without v prefix', () => {
    expect(isVersionGreater('v1.0.1', '1.0.0')).toBe(true);
    expect(isVersionGreater('1.1.0', '1.0.0')).toBe(true);
    expect(isVersionGreater('v2.0.0', 'v1.9.9')).toBe(true);
    expect(isVersionGreater('1.0.0', '1.0.0')).toBe(false);
    expect(isVersionGreater('v1.0.0', '1.0.0')).toBe(false);
    expect(isVersionGreater('1.0.0', '1.0.1')).toBe(false);
    expect(isVersionGreater('0.9.9', '1.0.0')).toBe(false);
  });
});
