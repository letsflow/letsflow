import { expect } from 'chai';
import { ActionEvent, instantiate, step } from '../../src/process';
import { normalize } from '../../src/scenario';
import { uuid } from '../../src';
import { hash } from '../../src/process/hash';

describe('step', () => {
  describe('transition', () => {
    it('should step to end state', () => {
      const scenario = normalize({
        title: 'some scenario',
        actions: {
          complete: {},
        },
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
          },
        },
      });

      const instructions = {
        scenario: uuid(scenario),
        actors: {
          actor: { id: 'eb82534d-1b99-415f-8d32-096070ea3310' },
        },
      };

      const newProcess = instantiate(scenario, instructions);
      const process = step(newProcess, 'complete', 'actor');

      expect(process.events).to.have.length(2);
      const { hash: eventHash, ...event } = process.events[1] as ActionEvent;
      expect(event.timestamp).to.be.instanceof(Date);
      expect(event.previous).to.eq(process.events[0].hash);
      expect(event.response).to.be.undefined;
      expect(event.action).to.eq('complete');
      expect(event.actor).to.deep.eq({
        id: 'eb82534d-1b99-415f-8d32-096070ea3310',
        key: 'actor',
      });
      expect(eventHash).to.eq(hash(event));

      expect(process.current.key).to.eq('(done)');
      expect(process.current.title).to.eq('done');
      expect(process.current.timestamp.toISOString()).to.eq(process.events[1].timestamp.toISOString());
    });

    it('should step to the next state', () => {
      const scenario = normalize({
        title: 'some scenario',
        actions: {
          next: {},
          complete: {},
        },
        states: {
          initial: {
            transitions: [
              { on: 'next', goto: 'second' },
              { on: 'complete', goto: '(done)' },
            ],
          },
          second: {
            on: 'complete',
            goto: '(done)',
          },
        },
      });

      const instructions = {
        scenario: uuid(scenario),
        actors: {
          actor: { id: 'eb82534d-1b99-415f-8d32-096070ea3310' },
        },
      };

      const newProcess = instantiate(scenario, instructions);
      const process = step(newProcess, 'next', 'actor');

      expect(process.events).to.have.length(2);
      const { hash: eventHash, ...event } = process.events[1] as ActionEvent;
      expect(event.timestamp).to.be.instanceof(Date);
      expect(event.previous).to.eq(process.events[0].hash);
      expect(event.response).to.be.undefined;
      expect(event.action).to.eq('next');
      expect(event.actor).to.deep.eq({
        id: 'eb82534d-1b99-415f-8d32-096070ea3310',
        key: 'actor',
      });
      expect(eventHash).to.eq(hash(event));

      expect(process.current.key).to.eq('second');
      expect(process.current.timestamp.toISOString()).to.eq(process.events[1].timestamp.toISOString());
    });

    it('should stay in the current state', () => {
      const scenario = normalize({
        title: 'some scenario',
        actions: {
          nop: {},
          complete: {},
        },
        states: {
          initial: {
            actions: ['nop', 'complete'],
            transitions: [{ on: 'complete', goto: '(done)' }],
          },
        },
      });

      const instructions = {
        scenario: uuid(scenario),
        actors: {
          actor: { id: 'eb82534d-1b99-415f-8d32-096070ea3310' },
        },
      };

      const newProcess = instantiate(scenario, instructions);
      const process = step(newProcess, 'nop', 'actor');

      expect(process.events).to.have.length(2);
      const { hash: eventHash, ...event } = process.events[1] as ActionEvent;
      expect(event.timestamp).to.be.instanceof(Date);
      expect(event.previous).to.eq(process.events[0].hash);
      expect(event.response).to.be.undefined;
      expect(event.action).to.eq('nop');
      expect(event.actor).to.deep.eq({
        id: 'eb82534d-1b99-415f-8d32-096070ea3310',
        key: 'actor',
      });
      expect(eventHash).to.eq(hash(event));

      expect(process.current.key).to.eq('initial');
      expect(process.current.timestamp.toISOString()).to.eq(newProcess.current.timestamp.toISOString());
    });

    it('should not allow stepping out of an end state', () => {
      const scenario = normalize({
        title: 'some scenario',
        actions: {
          complete: {},
        },
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
          },
        },
      });

      const instructions = {
        scenario: uuid(scenario),
        actors: {
          actor: { id: 'eb82534d-1b99-415f-8d32-096070ea3310' },
        },
      };

      const newProcess = instantiate(scenario, instructions);
      const process = step(newProcess, 'complete', 'actor');

      expect(() => step(process, 'complete', 'actor')).to.throw("Process is in end state '(done)'");
    });

    it("should not perform an action that's not allowed in the state", () => {
      const scenario = normalize({
        title: 'some scenario',
        actions: {
          dance: {},
          complete: {},
        },
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
          },
        },
      });

      const instructions = {
        scenario: uuid(scenario),
        actors: {
          actor: { id: 'eb82534d-1b99-415f-8d32-096070ea3310' },
        },
      };

      const newProcess = instantiate(scenario, instructions);

      expect(() => step(newProcess, 'dance', 'actor')).to.throw("Action 'dance' is not allowed in state 'initial'");
    });
  });

  describe('assert actor', () => {
    const scenario = normalize({
      title: 'some scenario',
      actors: {
        user: {},
        admin: {},
      },
      actions: {
        complete: {
          actor: 'admin',
        },
      },
      states: {
        initial: {
          on: 'complete',
          goto: '(done)',
        },
      },
      vars: {
        foo: { type: 'string' },
      },
    });

    const instructions = {
      scenario: uuid(scenario),
      actors: {
        user: { id: 'eb82534d-1b99-415f-8d32-096070ea3310' },
      },
    };

    const newProcess = instantiate(scenario, instructions);

    it('should check if an actor is defined', () => {
      expect(() => step(newProcess, 'complete', 'captain')).to.throw("Actor 'captain' is not defined in the scenario");
    });

    it('should check if an actor is assigned', () => {
      expect(() => step(newProcess, 'complete', 'admin')).to.throw("Actor 'admin' is not assigned to a user");
    });

    it('should check if an actor is allowed to perform an action', () => {
      expect(() => step(newProcess, 'complete', 'user')).to.throw(
        "Actor 'user' is not allowed to perform action 'complete'",
      );
    });
  });

  describe('update instructions', () => {
    it('should apply update instructions', () => {
      const scenario = normalize({
        title: 'some scenario',
        actions: {
          complete: {
            update: [
              { set: 'title', data: 'updated title' },
              { set: 'actors.actor.title', data: 'Updated actor' },
              { set: 'vars.foo', data: 'bar' },
            ],
          },
        },
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
          },
        },
        vars: {
          foo: { type: 'string' },
        },
      });

      const instructions = {
        scenario: uuid(scenario),
        actors: {
          actor: { id: 'eb82534d-1b99-415f-8d32-096070ea3310' },
        },
      };

      const newProcess = instantiate(scenario, instructions);
      const process = step(newProcess, 'complete', 'actor');

      expect(process.current.key).to.eq('(done)');

      expect(process.title).to.eq('updated title');

      expect(process.actors.actor).to.deep.eq({
        title: 'Updated actor',
        id: 'eb82534d-1b99-415f-8d32-096070ea3310',
      });

      expect(process.vars.foo).to.eq('bar');
    });

    it('should use the response', () => {
      const scenario = normalize({
        title: 'some scenario',
        actions: {
          complete: {
            update: { set: 'vars.foo' },
          },
        },
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
          },
        },
        vars: {
          foo: { type: 'string' },
        },
      });

      const instructions = {
        scenario: uuid(scenario),
        actors: {
          actor: { id: 'eb82534d-1b99-415f-8d32-096070ea3310' },
        },
      };

      const newProcess = instantiate(scenario, instructions);
      const process = step(newProcess, 'complete', 'actor', 'bar');

      expect(process.current.key).to.eq('(done)');

      expect(process.vars.foo).to.eq('bar');
    });

    it('should not allow updating the current state through update instructions', () => {
      const scenario = normalize({
        title: 'some scenario',
        actions: {
          complete: {
            update: { set: 'current.key', data: '(whoops)' },
          },
        },
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
          },
        },
      });

      const instructions = {
        scenario: uuid(scenario),
        actors: {
          actor: { id: 'eb82534d-1b99-415f-8d32-096070ea3310' },
        },
      };

      const newProcess = instantiate(scenario, instructions);
      expect(() => step(newProcess, 'complete', 'actor')).to.throw(
        "Not allowed to set 'current.key' through update instructions",
      );
    });
  });
});
