import { expect } from 'chai';
import { applyFn, ref, tpl } from '../src/fn';

describe('ref', () => {
  const data = { name: 'Alice', age: 25, map: { a: 1, b: 2, c: 3 } };

  it('should apply jmespath expressions correctly', () => {
    expect(ref('name', data)).to.eq('Alice');
    expect(ref('age', data)).to.eq(25);

    expect(ref('map.*', data)).to.deep.equal([1, 2, 3]);
  });

  it('should auto quote string literals', () => {
    expect(ref('age >= 21', data)).to.be.true;
    expect(ref('age < 21', data)).to.be.false;
  });
});

describe('tpl', () => {
  const data = { name: 'Alice', age: 25, map: { a: 1, b: 2, c: 3 }, list: ['one', 'two', 'three'] };

  it('should extract and replace expressions correctly', () => {
    expect(tpl('Hello, {{name}}!', data)).to.eq('Hello, Alice!');
    expect(tpl('{{ age }} years old.', data)).to.eq('25 years old.');
  });

  it('should loop over an array', () => {
    expect(tpl('Items: {{#list}}{{.}} {{/list}}', data)).to.eq('Items: one two three ');
  });

  it('should extract multiple expressions in a single string', () => {
    expect(tpl('Name: {{ name }}, Age: {{ age }}.', data)).to.eq('Name: Alice, Age: 25.');
  });

  it('should handle errors for unmatched brackets', () => {
    expect(() => tpl('{{name', data)).to.throw(Error);
    expect(() => tpl('{{ {name }}', data)).to.throw(Error);
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

  it('should call tpl function when encountering "<tpl>" key with a string', () => {
    const subject = { '<tpl>': 'Hello, {{ name }}!' };
    const data = { name: 'Alice' };
    const expected = 'Hello, Alice!';

    const result = applyFn(subject, data);

    expect(result).to.eq(expected);
  });

  it('should call tpl function when encountering "<tpl>" key with template and data', () => {
    const subject = { '<tpl>': { template: 'Hello, {{ name }}!', view: { name: 'Alice' } } };
    const expected = 'Hello, Alice!';

    const result = applyFn(subject, {});

    expect(result).to.eq(expected);
  });

  it('should recursively apply the function to each item in an array', () => {
    const subject = [
      { '<ref>': 'name' },
      { '<tpl>': 'Hello, {{ name }}!' },
      [1, 2, 3],
      [{ '<ref>': 'age' }, { '<tpl>': 'Age: {{ age }}' }],
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
        greeting: { '<tpl>': 'Hello, {{ name }}!' },
      },
      items: {
        a: { '<ref>': 'age' },
        b: { '<tpl>': 'Age: {{ age }}' },
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

  it('should apply a <ref> function to the data of a <tpl> function', () => {
    const subject = {
      '<tpl>': { template: 'Hello, {{ name }}!', view: { '<ref>': 'persons.friend' } },
    };
    const expected = 'Hello, Alice!';
    const data = { persons: { friend: { name: 'Alice' } } };

    const result = applyFn(subject, data);

    expect(result).to.eq(expected);
  });

  it('should apply partials to a <tpl> function', () => {
    const subject = {
      '<tpl>': { template: '{{> greeting }}!', partials: { '<ref>': 'partials' } },
    };
    const expected = 'Hello, Alice!';
    const data = {
      name: 'Alice',
      partials: { greeting: 'Hello, {{ name }}' },
    };

    const result = applyFn(subject, data);

    expect(result).to.eq(expected);
  });
});

describe('select', () => {
  it('should return the selected value', () => {
    const subject = {
      '<select>': {
        $: 'foo',
        foo: 42,
        bar: 99,
        '*': 1,
      },
    };

    const result = applyFn(subject, {});

    expect(result).to.eq(42);
  });

  it('should return the selected numeric value', () => {
    const subject = {
      '<select>': {
        $: 42,
        42: 'foo',
        99: 'bar',
      },
    };

    const result = applyFn(subject, {});

    expect(result).to.eq('foo');
  });

  it('should return the selected boolean value', () => {
    const subject = {
      '<select>': {
        $: true,
        true: 'foo',
        false: 'bar',
      },
    };

    const result = applyFn(subject, {});

    expect(result).to.eq('foo');
  });

  it('should select the default value if the key is not found', () => {
    const subject = {
      '<select>': {
        $: 'baz',
        foo: 42,
        bar: 99,
        '*': 1,
      },
    };

    const result = applyFn(subject, {});

    expect(result).to.eq(1);
  });

  it('should return null if the key is not found and no default value is provided', () => {
    const subject = {
      '<select>': {
        $: 'baz',
        foo: 42,
        bar: 99,
      },
    };

    const result = applyFn(subject, {});

    expect(result).to.be.null;
  });

  it('should apply a <ref> function to the data of a <select> function', () => {
    const subject = {
      '<select>': {
        $: { '<ref>': 'key' },
        foo: { '<ref>': 'correct' },
        bar: { '<ref>': 'incorrect' },
      },
    };
    const expected = 42;
    const data = { key: 'foo', correct: 42, incorrect: 99 };

    const result = applyFn(subject, data);

    expect(result).to.eq(expected);
  });
});
