import { expect } from 'chai';
import { ref, sub, applyFn } from '../../src/process/fn';

describe('ref', () => {
  const data = { name: 'Alice', age: 25, items: { a: 1, b: 2, c: 3 } };

  it('should apply jmespath expressions correctly', () => {
    expect(ref('name', data)).to.eq('Alice');
    expect(ref('age', data)).to.eq(25);

    expect(ref('items.*', data)).to.deep.equal([1, 2, 3]);
  });

  it('should auto quote string literals', () => {
    expect(ref('age >= 21', data)).to.be.true;
    expect(ref('age < 21', data)).to.be.false;
  });
});

describe('sub', () => {
  const data = { name: 'Alice', age: 25, items: { a: 1, b: 2, c: 3 } };

  it('should extract and replace expressions correctly', () => {
    expect(sub('Hello, ${name}!', data)).to.eq('Hello, Alice!');
    expect(sub('${age} years old.', data)).to.eq('25 years old.');
  });

  it('should extract expressions with {', () => {
    expect(sub('${age} {{ years old }', data)).to.eq('25 {{ years old }');
  });

  it('should extract multiple expressions in a single string', () => {
    expect(sub('Name: ${name}, Age: ${age}.', data)).to.eq('Name: Alice, Age: 25.');
  });

  it('should extract expression with quoted brackets', () => {
    expect(sub("Value: ${'{'}", data)).to.eq('Value: {');
    expect(sub("Value: ${'}'}", data)).to.eq('Value: }');
    expect(sub("Value: ${'{}'}", data)).to.eq('Value: {}');
    expect(sub("Value: ${'{'} and ${'}'}", data)).to.eq('Value: { and }');
  });

  it('should extract expression with nested brackets', () => {
    expect(sub('Nested: ${to_string(items.{x: a, y: b})}', data)).to.eq('Nested: {"x":1,"y":2}');
  });

  it('should extract expression with nested quoted brackets', () => {
    const result = sub("Nested: ${items.* | [].to_string(@) | join('{', @)}", data);
    expect(result).to.eq('Nested: 1{2{3');
  });

  it('should handle errors for unmatched brackets', () => {
    expect(() => sub('${name', data)).to.throw(Error);
    expect(() => sub('${{name}', data)).to.throw(Error);
  });
});

describe('applyFn', () => {
  it('should return the same value if the subject is not an object or null', () => {
    const subject1 = 42;
    const subject2 = 'Hello, world!';
    const subject3 = null;
    const subject4 = new Date();

    const data = {};

    expect(applyFn(subject1, data)).to.eq(subject1);
    expect(applyFn(subject2, data)).to.eq(subject2);
    expect(applyFn(subject3, data)).to.eq(subject3);
    expect(applyFn(subject4, data)).to.eq(subject4);
  });

  it('should call ref function when encountering "<ref>" key', () => {
    const subject = { '<ref>': 'name' };
    const data = { name: 'Alice' };
    const expected = 'Alice';

    const result = applyFn(subject, data);

    expect(result).to.eq(expected);
  });

  it('should call sub function when encountering "<sub>" key', () => {
    const subject = { '<sub>': 'Hello, ${name}!' };
    const data = { name: 'Alice' };
    const expected = 'Hello, Alice!';

    const result = applyFn(subject, data);

    expect(result).to.eq(expected);
  });

  it('should recursively apply the function to each item in an array', () => {
    const subject = [
      { '<ref>': 'name' },
      { '<sub>': 'Hello, ${name}!' },
      [1, 2, 3],
      [{ '<ref>': 'age' }, { '<sub>': 'Age: ${age}' }],
    ];
    const expected = ['Alice', 'Hello, Alice!', [1, 2, 3], [25, 'Age: 25']];
    const data = { name: 'Alice', age: 25 };

    const result = applyFn(subject, data);

    expect(result).to.deep.equal(expected);
  });

  it('should recursively apply the function to each value in an object', () => {
    const subject = {
      person: {
        name: { '<ref>': 'name' },
        greeting: { '<sub>': 'Hello, ${name}!' },
      },
      items: {
        a: { '<ref>': 'age' },
        b: { '<sub>': 'Age: ${age}' },
      },
    };
    const expected = {
      person: {
        name: 'Alice',
        greeting: 'Hello, Alice!',
      },
      items: {
        a: 25,
        b: 'Age: 25',
      },
    };
    const data = { name: 'Alice', age: 25 };

    const result = applyFn(subject, data);

    expect(result).to.deep.equal(expected);
  });
});

describe('jmespath functions', () => {
  describe('if', () => {
    it('should return the correct value based on the condition', () => {
      expect(ref('if(`true`, 1)', {})).to.eq(1);
      expect(ref('if(`true`, 1, 2)', {})).to.eq(1);

      expect(ref('if(`false`, 1)', {})).to.eq(undefined);
      expect(ref('if(`false`, 1, 2)', {})).to.eq(2);
    });
  });

  describe('json_serialize', () => {
    it('should serialize a value to a JSON string', () => {
      expect(ref('json_serialize({ a: 1, b: 2 })', {})).to.eq('{"a":1,"b":2}');
    });

    it('should serialize in a deterministic way', () => {
      expect(ref('json_serialize({ b: 2, a: 1 })', {})).to.eq('{"a":1,"b":2}');
    });
  });

  describe('json_parse', () => {
    it('should parse a JSON string to an object', () => {
      expect(ref(`json_parse('{"a":1,"b":2}')`, {})).to.deep.eq({ a: 1, b: 2 });
    });
  });

  describe('sha256', () => {
    it('should return the SHA-256 hash of a string', () => {
      expect(ref(`sha256('hello')`, {})).to.eq('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    });
  });

  describe('uuidv5', () => {
    it('should return a UUID v5 from a value, defaulting to the NIL namespace', () => {
      expect(ref(`uuidv5('world')`, {})).to.eq('5cc3cd15-3e1f-540d-ab8c-2d59c330d924');
    });

    it('should return a UUID v5 from a value and namespace', () => {
      const result = ref(`uuidv5('hello', '5cc3cd15-3e1f-540d-ab8c-2d59c330d924')`, {});
      expect(result).to.eq('d4edcd3d-fe56-55f9-80a1-c461488be52e');
    });
  });

  describe('re_test', () => {
    it('should return true if a regular expression matches a string', () => {
      expect(ref(`re_test('/t(e)(st(\\d?))/', 'test1!')`, {})).to.be.true;
    });

    it('should return false if a regular expression does not match a string', () => {
      expect(ref(`re_test('/t(e)(st(\\d?))/', 'hello')`, {})).to.be.false;
    });

    it('should apply flags of a regular expression', () => {
      expect(ref(`re_test('/t(e)(st(\\d?))/i', 'Test1test2')`, {})).to.be.true;
    });
  });

  describe('re_match', () => {
    it('should return the matched groups of a regular expression', () => {
      const expected = ['test1', 'e', 'st1', '1'];
      expect(ref(`re_match('/t(e)(st(\\d?))/', 'test1!')`, {})).to.deep.eq(expected);
    });

    it('should apply flags of a regular expression', () => {
      const expected = ['Test1', 'test2'];
      expect(ref(`re_match('/t(e)(st(\\d?))/gi', 'Test1test2')`, {})).to.deep.eq(expected);
    });
  });

  describe('re_match_all', () => {
    it('should return all matched groups of a regular expression', () => {
      const expected = [
        ['test1', 'e', 'st1', '1'],
        ['test2', 'e', 'st2', '2'],
      ];
      expect(ref(`re_match_all('/t(e)(st(\\d?))/g', 'test1test2!')`, {})).to.deep.eq(expected);
    });
  });

  describe('re_replace', () => {
    it('should replace a regular expression with a replacement string', () => {
      const expected = 'hello world!';
      expect(ref(`re_replace('/test/', 'hello test!', 'world')`, {})).to.eq(expected);
    });

    it('should replace all occurrences of a regular expression with a replacement string', () => {
      const expected = 'hello world world!';
      expect(ref(`re_replace('/test/g', 'hello test test!', 'world')`, {})).to.eq(expected);
    });
  });
});
