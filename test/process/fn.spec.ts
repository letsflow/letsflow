import { expect } from 'chai';
import { ref, sub } from '../../src/process/fn';

describe('ref function', () => {
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

describe('sub function', () => {
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
