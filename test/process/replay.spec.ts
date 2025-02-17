import { expect } from 'chai';
import { uuid } from '../../src';
import {
  ActionEvent,
  chain,
  instantiate,
  migrate,
  Process,
  replay,
  step,
  TimeoutEvent,
  withHash,
} from '../../src/process';
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

  describe('exceptions', () => {
    const scenario = normalize({
      actions: {
        setValue: {
          update: {
            set: 'vars.count',
          },
        },
      },
      states: {
        initial: {
          transitions: [
            {
              on: 'next',
              goto: 'second',
            },
            {
              on: 'setValue',
              goto: null,
            },
            {
              on: 'cancel',
              if: false,
              goto: '(cancelled)',
            },
          ],
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
      vars: {
        count: 'integer',
      },
    });

    let process: Process;

    beforeEach(() => {
      process = instantiate(scenario);
    });

    it('should throw an error if the event does not follow the previous event', () => {
      const newEvent = step(process, 'next').events[1] as ActionEvent;
      newEvent.previous = 'invalid';

      expect(() => replay(process, [newEvent])).to.throw(`Event ${newEvent.hash} does not follow previous event`);
    });

    it('should throw an error if the first event is not an instantiate event', () => {
      const newEvent = step(process, 'next').events[1] as ActionEvent;

      expect(() => replay(scenario, [newEvent])).to.throw(
        'First event must be an instantiate event when replaying from genesis',
      );
    });

    it('should throw an error if when trying to replay instantiate event onto an existing process', () => {
      const instantiateEvent = instantiate(scenario).events[0];
      expect(() => replay(process, [instantiateEvent])).to.throw('Cannot replay an instantiate event');
    });

    it('should throw an error if the event should have been skipped', () => {
      const newEvent = step(process, 'foo').events[1] as ActionEvent;
      newEvent.skipped = false;
      newEvent.errors = undefined;

      expect(() => replay(process, [newEvent])).to.throw(
        `Event ${newEvent.hash} should have been skipped:\nAction 'foo' is not allowed in state 'initial'`,
      );
    });

    it('should throw an error if the event should have been skipped because no transition', () => {
      const newEvent = step(process, 'cancel').events[1] as ActionEvent;
      newEvent.skipped = false;
      newEvent.errors = undefined;

      expect(() => replay(process, [newEvent])).to.throw(
        `Event ${newEvent.hash} should have been skipped:\nNo transition found for action 'cancel' in state 'initial' for actor`,
      );
    });

    it('should throw an error if the event should have been skipped because of invalid variable', () => {
      const newEvent = step(process, 'setValue', 'actor', 'hello').events[1] as ActionEvent;
      newEvent.skipped = false;
      newEvent.errors = undefined;

      expect(() => replay(process, [newEvent])).to.throw(
        `Event ${newEvent.hash} should have been skipped:\nVariable 'count' is invalid: data must be integer`,
      );
    });

    it('should throw an error when replaying with an incorrect scenario', () => {
      const scenario2 = normalize({
        states: {
          initial: {
            on: 'next',
            goto: '(done)',
          },
        },
      });

      const events = step(instantiate(scenario), 'next').events;

      expect(() => replay(scenario2, events)).to.throw(
        `Event scenario id '${uuid(scenario)}' does not match scenario id '${uuid(scenario2)}'`,
      );
    });
  });
});

describe('migrate', () => {
  const scenario1 = normalize({
    states: {
      initial: {
        on: 'next',
        goto: 'second',
      },
      second: {
        transitions: [
          {
            on: 'next',
            goto: '(done)',
          },
          {
            on: 'cancel',
            goto: '(cancelled)',
          },
        ],
      },
    },
  });

  const scenario2 = normalize({
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

  it('should migrate events', () => {
    const process = chain(
      instantiate(scenario1),
      (process) => step(process, 'next'),
      (process) => step(process, 'next'),
    );

    expect(process.current.key).to.equal('(done)');

    const migrated = migrate(scenario2, process.events);
    expect(migrated.scenario.id).to.equal(uuid(scenario2));
    expect(migrated.current.key).to.equal('third');
  });

  it('should throw an error if the first event is not an instantiate event', () => {
    const process = step(instantiate(scenario1), 'next');

    expect(() => migrate(scenario2, process.events.slice(1))).to.throw(
      'First event must be an instantiate event when migrating',
    );
  });

  it("should throw an error if it's not possible to step through the events", () => {
    const process = chain(
      instantiate(scenario1),
      (process) => step(process, 'next'),
      (process) => step(process, 'cancel'),
    );

    expect(() => migrate(scenario2, process.events)).to.throw("Action 'cancel' is not allowed in state 'second'");
  });
});
