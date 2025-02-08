import { expect } from 'chai';
import { instantiate, predict, step } from '../../src/process';
import { normalize } from '../../src/scenario';

describe('predict', () => {
  it('should predict a sequence of states', () => {
    const scenario = normalize({
      states: {
        initial: { on: 'next', goto: 'middle' },
        middle: { on: 'next', goto: '(done)' },
      },
    });

    const process = instantiate(scenario);
    const result = predict(process);

    expect(result.map((s) => s.key)).to.deep.equal(['initial', 'middle', '(done)']);
  });

  it('should start from the current state', () => {
    const scenario = normalize({
      states: {
        initial: { on: 'next', goto: 'middle' },
        middle: { on: 'next', goto: '(done)' },
      },
    });

    const process = step(instantiate(scenario), 'next');
    const result = predict(process);

    expect(result.map((s) => s.key)).to.deep.equal(['middle', '(done)']);
  });

  it('should follow a timeout transition', () => {
    const scenario = normalize({
      states: {
        initial: { after: 5000, goto: '(done)' },
      },
    });

    const process = instantiate(scenario);
    const result = predict(process);

    expect(result.map((s) => s.key)).to.deep.equal(['initial', '(done)']);
  });

  it('should prevent infinite loops', () => {
    const scenario = normalize({
      states: {
        initial: { on: 'next', goto: 'loop1' },
        loop1: { on: 'next', goto: 'loop2' },
        loop2: { on: 'next', goto: 'loop1' },
      },
    });

    const process = instantiate(scenario);
    const result = predict(process);

    expect(result.map((s) => s.key)).to.deep.equal(['initial', 'loop1', 'loop2', 'loop1']);
  });

  it('should take the first available transition', () => {
    const scenario = normalize({
      states: {
        initial: {
          transitions: [
            { on: 'fly', goto: '(success)' },
            { on: 'fall', goto: '(failed)' },
          ],
        },
      },
    });

    const process = instantiate(scenario);
    const result = predict(process);

    expect(result.map((s) => s.key)).to.deep.equal(['initial', '(success)']);
  });

  it('should take the first available transition with a condition', () => {
    const scenario = normalize({
      states: {
        initial: {
          transitions: [
            { on: 'fall', goto: '(failed)', if: false },
            { on: 'fly', goto: '(success)' },
          ],
        },
      },
    });

    const process = instantiate(scenario);
    const result = predict(process);

    expect(result.map((s) => s.key)).to.deep.equal(['initial', '(success)']);
  });

  it('should take the first available timeout with a condition', () => {
    const scenario = normalize({
      states: {
        initial: {
          transitions: [
            { after: 5000, goto: '(failed)', if: false },
            { after: 10000, goto: '(success)' },
          ],
        },
      },
    });

    const process = instantiate(scenario);
    const result = predict(process);

    expect(result.map((s) => s.key)).to.deep.equal(['initial', '(success)']);
  });

  it('should take the first available transition based on the action condition', () => {
    const scenario = normalize({
      actions: {
        fall: {
          if: false,
        },
        fly: {},
      },
      states: {
        initial: {
          transitions: [
            { on: 'fall', goto: '(failed)' },
            { on: 'fly', goto: '(success)' },
          ],
        },
      },
    });

    const process = instantiate(scenario);
    const result = predict(process);

    expect(result.map((s) => s.key)).to.deep.equal(['initial', '(success)']);
  });

  it('should skip a transition if the action is not allowed for the actor', () => {
    const scenario = normalize({
      actors: {
        admin: {},
        client: {},
      },
      actions: {
        fall: {
          actor: 'admin',
        },
        fly: {},
      },
      states: {
        initial: {
          transitions: [
            { on: 'fall', by: 'client', goto: '(failed)' },
            { on: 'fly', goto: '(success)' },
          ],
        },
      },
    });

    const process = instantiate(scenario);
    const result = predict(process);

    expect(result.map((s) => s.key)).to.deep.equal(['initial', '(success)']);
  });

  it('should skip response validation', () => {
    const scenario = normalize({
      actions: {
        fall: {},
        fly: {
          response: {
            properties: {
              foo: 'string',
            },
            required: ['foo'],
          },
        },
      },
      states: {
        initial: {
          transitions: [
            { on: 'fly', goto: '(success)' },
            { on: 'fall', goto: '(failed)' },
          ],
        },
      },
    });

    const process = instantiate(scenario);
    const result = predict(process);

    expect(result.map((s) => s.key)).to.deep.equal(['initial', '(success)']);
  });

  it('should allow for a transition to be picked based on `is_prediction`', () => {
    const scenario = normalize({
      states: {
        initial: {
          transitions: [
            {
              on: 'next',
              goto: '(done)',
              if: { '<ref>': 'is_prediction' },
            },
            {
              on: 'next',
              goto: 'second',
            },
          ],
        },
        second: {
          on: 'next',
          goto: '(done)',
        },
      },
    });

    const process = instantiate(scenario);
    const result = predict(process);

    expect(result.map((s) => s.key)).to.deep.equal(['initial', '(done)']);

    const stepped = step(process, 'next');
    expect(stepped.current.key).to.equal('second');
  });

  it('should use the stub as value for an update instruction during a prediction', () => {
    const scenario = normalize({
      actions: {
        sing: {
          response: 'string',
          update: {
            set: 'vars.song',
            stub: 'la la la',
          },
        },
      },
      states: {
        initial: {
          transitions: [
            {
              on: 'sing',
              goto: '(sad)',
              if: { '<ref>': '!(vars.song)' },
            },
            {
              on: 'sing',
              goto: '(happy)',
            },
          ],
        },
      },
      vars: {
        song: 'string',
      },
    });

    const process = instantiate(scenario);
    const result = predict(process);

    expect(result.map((s) => s.key)).to.deep.equal(['initial', '(happy)']);

    const stepped = step(process, 'sing', 'actor', '');
    expect(stepped.vars.song).to.equal('');
    expect(stepped.current.key).to.equal('(sad)');
  });

  it('shoul predict through a loop to the end state', () => {
    const scenario = normalize({
      actions: {
        sign: {
          update: {
            set: 'vars.signed',
            value: true,
          },
        },
      },
      states: {
        initial: {
          transitions: [
            {
              on: 'next',
              goto: 'middle',
              if: { '<ref>': '!(vars.signed)' },
            },
            {
              on: 'next',
              goto: '(done)',
            },
          ],
        },
        middle: { on: 'sign', goto: 'initial' },
      },
      vars: {
        signed: {
          type: 'boolean',
          default: false,
        },
      },
    });

    const process = instantiate(scenario);
    const result = predict(process);

    expect(result.map((s) => s.key)).to.deep.equal(['initial', 'middle', 'initial', '(done)']);
  });

  it('should throw an error on max iterations reached', () => {
    const scenario = normalize({
      actions: {
        next: {
          update: {
            set: 'vars.count',
            value: { '<ref>': 'vars.count + 1' },
          },
        },
      },
      states: {
        initial: { on: 'next', goto: 'middle' },
        middle: { on: 'next', goto: 'initial' },
      },
      vars: {
        count: {
          type: 'number',
          default: 0,
        },
      },
    });

    const process = instantiate(scenario);
    expect(() => predict(process, { max: 10 })).to.throw('Max iterations reached');
  });
});
