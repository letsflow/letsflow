import { parse, stringify } from '../src/yaml';
import { expect } from 'chai';

describe('yaml', () => {
  describe('parse', () => {
    it('should parse basic yaml', () => {
      const yamlString = `
        foo: bar
        baz:
          - qux
          - quux
      `;

      const data = parse(yamlString);

      expect(data).to.eql({
        foo: 'bar',
        baz: ['qux', 'quux'],
      });
    });

    it('should parse yaml with custom tags', () => {
      const yamlString = `
        foo: !ref abc
        bar: !eval abc > 0
        qux: !tpl "Hello, {{ name }}!"
      `;

      const data = parse(yamlString);

      expect(data).to.eql({
        foo: { '<ref>': 'abc' },
        bar: { '<eval>': 'abc > 0' },
        qux: { '<tpl>': 'Hello, {{ name }}!' },
      });
    });
  });

  describe('stringify', () => {
    it('should stringify basic yaml', () => {
      const data = {
        foo: 'bar',
        baz: ['qux', 'quux'],
      };

      const yamlString = stringify(data);

      expect(yamlString.trim()).to.eql(
        `
        foo: bar
        baz:
          - qux
          - quux
      `
          .replace(/^\s{8}/gm, '')
          .trim(),
      );
    });

    it('should stringify yaml with custom tags', () => {
      const data = {
        foo: { '<ref>': 'abc' },
        bar: { '<eval>': 'abc > 0' },
        bor: { '<eval>': '!def' },
        qux: { '<tpl>': 'Hello, {{ name }}!' },
      };

      const yamlString = stringify(data);

      expect(yamlString.trim()).to.eql(
        `
        foo: !ref abc
        bar: !eval abc > 0
        bor: !eval "!def"
        qux: !tpl Hello, {{ name }}!
      `
          .replace(/^\s{8}/gm, '')
          .trim(),
      );
    });
  });
});
