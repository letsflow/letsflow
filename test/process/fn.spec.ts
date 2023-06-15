import { expect } from 'chai';
import { ref, sub, applyFn } from '../../src/process/fn';

describe('ref', () => {
  const data = { name: 'Alice', age: 25, items: { a: 1, b: 2, c: 3 } };

  it('should apply jmespath expressions correctly', () => {
    expect(ref('name', data)).to.equal('Alice');
    expect(ref('age', data)).to.equal(25);

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
    expect(sub('Hello, ${name}!', data)).to.equal('Hello, Alice!');
    expect(sub('${age} years old.', data)).to.equal('25 years old.');
  });

  it('should extract expressions with {', () => {
    expect(sub('${age} {{ years old }', data)).to.equal('25 {{ years old }');
  });

  it('should extract multiple expressions in a single string', () => {
    expect(sub('Name: ${name}, Age: ${age}.', data)).to.equal('Name: Alice, Age: 25.');
  });

  it('should extract expression with quoted brackets', () => {
    expect(sub("Value: ${'{'}", data)).to.equal('Value: {');
    expect(sub("Value: ${'}'}", data)).to.equal('Value: }');
    expect(sub("Value: ${'{}'}", data)).to.equal('Value: {}');
    expect(sub("Value: ${'{'} and ${'}'}", data)).to.equal('Value: { and }');
  });

  it('should extract expression with nested brackets', () => {
    expect(sub('Nested: ${to_string(items.{x: a, y: b})}', data)).to.equal('Nested: {"x":1,"y":2}');
  });

  it('should extract expression with nested quoted brackets', () => {
    const result = sub("Nested: ${items.* | [].to_string(@) | join('{', @)}", data);
    expect(result).to.equal('Nested: 1{2{3');
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

    expect(applyFn(subject1, data)).to.equal(subject1);
    expect(applyFn(subject2, data)).to.equal(subject2);
    expect(applyFn(subject3, data)).to.equal(subject3);
    expect(applyFn(subject4, data)).to.equal(subject4);
  });

  it('should call ref function when encountering "<ref>" key', () => {
    const subject = { '<ref>': 'name' };
    const data = { name: 'Alice' };
    const expected = 'Alice';

    const result = applyFn(subject, data);

    expect(result).to.equal(expected);
  });

  it('should call sub function when encountering "<sub>" key', () => {
    const subject = { '<sub>': 'Hello, ${name}!' };
    const data = { name: 'Alice' };
    const expected = 'Hello, Alice!';

    const result = applyFn(subject, data);

    expect(result).to.equal(expected);
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
