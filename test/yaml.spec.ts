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
        bar: !ref abc > 0
        qux: !sub "Hello, \${ name }!"
      `;

      const data = parse(yamlString);

      expect(data).to.eql({
        foo: { '<ref>': 'abc' },
        bar: { '<ref>': 'abc > 0' },
        qux: { '<sub>': 'Hello, ${ name }!' },
      });
    });

    it('should parse yaml with custom and default tags', () => {
      const yamlString = `
        foo: !const abc
        bar: !const 10
        rob: !default abc
        qux: !default true
        wam: !default 22
      `;

      const data = parse(yamlString);

      expect(data).to.eql({
        foo: { const: 'abc' },
        bar: { const: 10 },
        rob: { type: 'string', default: 'abc' },
        qux: { type: 'boolean', default: true },
        wam: { type: 'number', default: 22 },
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
        bar: { '<ref>': 'abc > 0' },
        rob: { '<ref>': '!def' },
        qux: { '<sub>': 'Hello, ${ name }!' },
      };

      const yamlString = stringify(data);

      expect(yamlString.trim()).to.eql(
        `
        foo: !ref abc
        bar: !ref abc > 0
        rob: !ref "!def"
        qux: !sub Hello, \${ name }!
      `
          .replace(/^\s{8}/gm, '')
          .trim(),
      );
    });
  });
});
