import { expect } from 'chai';
import { fnSchema } from '../src/schemas/v1.0';
import { parse, stringify } from '../src/yaml';

describe('yaml', () => {
  describe('parse', () => {
    it('t', () => {
      const yamlString = `
one: !ref abc.def
two: !tpl "hello {{ planet }}"
three: !tpl
  template: "hello {{ planet }}"
  view: !ref current.response
four: !const abc
five: !enum
  - a
  - b
  - c
six: !format datetime
seven: !default 1234
eight: !pattern /^foo/
nine: !required string
ten: !required
  type: array
  items: string
eleven: !fn boolean
twelve: !merge abc.def
thirteen: !append abc.def`;

      const data = parse(yamlString);

      console.log(JSON.stringify(data, null, 2));
    });

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

    it('should parse yaml with fn tags', () => {
      const yamlString = `
        foo: !fn string
        bar: !fn
          type: array
          items: !fn string
        wux:
          type: object
          properties:
            one: !fn string
            two: number
      `;

      const data = parse(yamlString);

      expect(data).to.eql({
        foo: { oneOf: [{ type: 'string' }, { $ref: fnSchema.$id }] },
        bar: {
          oneOf: [
            { type: 'array', items: { oneOf: [{ type: 'string' }, { $ref: fnSchema.$id }] } },
            { $ref: fnSchema.$id },
          ],
        },
        wux: {
          type: 'object',
          properties: {
            one: { oneOf: [{ type: 'string' }, { $ref: fnSchema.$id }] },
            two: 'number',
          },
        },
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
