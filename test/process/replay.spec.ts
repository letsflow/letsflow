import { expect } from 'chai';
import { chain, instantiate, step, TimeoutEvent, withHash } from '../../src/process';
import { replay } from '../../src/process/replay';
import { normalize } from '../../src/scenario';

describe('replay', () => {
  it('should replay a simple scenario', () => {
    const scenario = normalize({
      states: {
        initial: {
          on: 'next',
          goto: 'second',
        },
        second: {
          on: 'next',
          goto: 'third',
        },
        third: {
          on: 'next',
          goto: '(done)',
        },
      },
    });

    const process = chain(
      instantiate(scenario),
      (process) => step(process, 'next'),
      (process) => step(process, 'next'),
    );

    const result = replay(scenario, process.events);

    expect(result.id).to.equal(process.id);
    expect(result.current.key).to.equal('third');

    expect(result.events).to.deep.equal(process.events);
  });

  it('should apply update instructions', () => {
    const scenario = normalize({
      actions: {
        count: {
          update: 'vars.count',
        },
      },
      states: {
        initial: {
          on: 'count',
          goto: '(done)',
        },
      },
      vars: {
        count: 'integer',
      },
    });

    const process = step(instantiate(scenario), 'count', 'actor', 42);

    const result = replay(scenario, process.events);

    expect(result.current.key).to.equal('(done)');
    expect(result.vars.count).to.equal(42);

    expect(result.events).to.deep.equal(process.events);
  });

  it('should replay added events', () => {
    const scenario = normalize({
      states: {
        initial: {
          on: 'next',
          goto: 'second',
        },
        second: {
          on: 'next',
          goto: 'third',
        },
        third: {
          on: 'next',
          goto: '(done)',
        },
      },
    });

    const process = step(instantiate(scenario), 'next');

    const newEvents = chain(
      process,
      (process) => step(process, 'next'),
      (process) => step(process, 'next'),
    ).events.slice(process.events.length);

    const result = replay(process, newEvents);

    expect(result.id).to.equal(process.id);
    expect(result.current.key).to.equal('(done)');
  });

  it('should replay a timeout event', () => {
    const scenario = normalize({
      states: {
        initial: {
          after: '3 minutes',
          goto: '(done)',
        },
      },
    });

    const process = instantiate(scenario);

    const event = withHash<TimeoutEvent>({
      previous: process.events[0].hash,
      timestamp: new Date(Date.now() + 5 * 60 * 1000),
    });

    const result = replay(process, [event]);

    expect(result.id).to.equal(process.id);
    expect(result.current.key).to.equal('(done)');
  });
});
