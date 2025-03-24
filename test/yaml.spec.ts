import { expect } from 'chai';
import { parse, stringify } from '../src/yaml';

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

    it('should parse yaml with data function tags', () => {
      const yamlString = `
        foo: !ref abc
        bar: !ref abc > 0
        qux: !tpl "Hello, {{ name }}!"
        wam: !tpl
          template: "Hello, {{ name }}!"
          view: { name: "John" }
        des: !select
          $: !ref type
          foo: 42
          bar: 99
          '*': 1
      `;

      const data = parse(yamlString);

      expect(data).to.eql({
        foo: { '<ref>': 'abc' },
        bar: { '<ref>': 'abc > 0' },
        qux: { '<tpl>': 'Hello, {{ name }}!' },
        wam: {
          '<tpl>': {
            template: 'Hello, {{ name }}!',
            view: { name: 'John' },
          },
        },
        des: {
          '<select>': {
            $: { '<ref>': 'type' },
            foo: 42,
            bar: 99,
            '*': 1,
          },
        },
      });
    });

    it('should parse yaml with const tags', () => {
      const yamlString = `
        foo: !const abc
        bar: !const 10
      `;

      const data = parse(yamlString);

      expect(data).to.eql({
        foo: { const: 'abc' },
        bar: { const: 10 },
      });
    });

    it('should parse yaml with enum tags', () => {
      const yamlString = `
        one: !enum [abc, def, ghi]
        two: !enum
          - abc
          - def
          - ghi
      `;

      const data = parse(yamlString);

      expect(data).to.eql({
        one: { enum: ['abc', 'def', 'ghi'] },
        two: { enum: ['abc', 'def', 'ghi'] },
      });
    });

    it('should parse yaml with default tags', () => {
      const yamlString = `
        rob: !default abc
        qux: !default true
        wam: !default 22
        lop: !default ~
      `;

      const data = parse(yamlString);

      expect(data).to.eql({
        rob: { type: 'string', default: 'abc' },
        qux: { type: 'boolean', default: true },
        wam: { type: 'integer', default: 22 },
        lop: { default: null },
      });
    });

    it('should parse yaml with required tags', () => {
      const yamlString = `
        foo: !required string
        bar: !required
          type: array
          items: string
        wux: !required
          type: object
          properties:
            one: !required string
            two: number
        omp: !required
      `;

      const data = parse(yamlString);

      expect(data).to.eql({
        foo: { type: 'string', '!required': true },
        bar: { type: 'array', items: 'string', '!required': true },
        wux: {
          type: 'object',
          properties: {
            one: { type: 'string', '!required': true },
            two: 'number',
          },
          '!required': true,
        },
        omp: { '!required': true },
      });
    });

    it('should parse yaml with format and pattern tags', () => {
      const yamlString = `
        foo: !format uuid
        bar: !format 'date-time'
        rob: !pattern ^[a-zA-Z]{3}$
        qux: !pattern '^\\d{13}$'
      `;

      const data = parse(yamlString);

      expect(data).to.eql({
        foo: { type: 'string', format: 'uuid' },
        bar: { type: 'string', format: 'date-time' },
        rob: { type: 'string', pattern: '^[a-zA-Z]{3}$' },
        qux: { type: 'string', pattern: '^\\d{13}$' },
      });
    });

    it('should parse yaml with update instruction mode tags', () => {
      const yamlString = `
        bar: !merge def
        rob: !append ghi
      `;

      const data = parse(yamlString);

      expect(data).to.eql({
        bar: { mode: 'merge', set: 'def' },
        rob: { mode: 'append', set: 'ghi' },
      });
    });

    it('support `<<` merge', () => {
      const yamlString = `
        foo: &foo
          bar: baz
          won: 10
        qux:
          <<: *foo
          baz: qux
          won: 20
      `;

      const data = parse(yamlString);

      expect(data).to.eql({
        foo: { bar: 'baz', won: 10 },
        qux: { bar: 'baz', baz: 'qux', won: 20 },
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

    it('should stringify yaml with data function tags', () => {
      const data = {
        foo: { '<ref>': 'abc' },
        bar: { '<ref>': 'abc > 0' },
        rob: { '<ref>': '!def' },
        qux: { '<tpl>': 'Hello, {{ name }}!' },
      };

      const yamlString = stringify(data);

      expect(yamlString.trim()).to.eql(
        `
        foo: !ref abc
        bar: !ref abc > 0
        rob: !ref "!def"
        qux: !tpl Hello, {{ name }}!
        `
          .replace(/^\s{8}/gm, '')
          .trim(),
      );
    });
  });
});
