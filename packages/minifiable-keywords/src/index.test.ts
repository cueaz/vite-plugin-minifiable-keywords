import { describe, expect, it } from 'vitest';
import { extractKeywords, generateModuleCode } from './index';

describe('minifiable-keywords', () => {
  describe('extractKeywords', () => {
    it('should extract keywords from code', () => {
      const code = `
        import * as K from 'virtual:keywords';
        const a = K.foo;
        const b = K.bar;
        type T = K.baz;
      `;
      const keywords = extractKeywords(code);
      expect(keywords).toEqual(new Set(['foo', 'bar', 'baz']));
    });

    it('should return an empty set if no keywords are found', () => {
      const code = `
        const a = 'foo';
        const b = 'bar';
      `;
      const keywords = extractKeywords(code);
      expect(keywords).toEqual(new Set());
    });
  });

  describe('generateModuleCode', () => {
    it('should generate module code with keywords', () => {
      const keywords = new Set(['foo', 'bar']);
      const code = generateModuleCode(keywords, true);
      expect(code).toContain(
        "export const foo = /* @__PURE__ */ Symbol('foo');",
      );
      expect(code).toContain(
        "export const bar = /* @__PURE__ */ Symbol('bar');",
      );
    });

    it('should generate module code without debug info in prod mode', () => {
      const keywords = new Set(['foo', 'bar']);
      const code = generateModuleCode(keywords, false);
      expect(code).toContain('export const foo = /* @__PURE__ */ Symbol();');
      expect(code).toContain('export const bar = /* @__PURE__ */ Symbol();');
    });
  });
});
