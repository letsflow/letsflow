import { expect } from 'chai';
import { uuid } from '../../src';
import { ActionEvent, instantiate, step } from '../../src/process';
import { hash } from '../../src/process/hash';
import { normalize } from '../../src/scenario';

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
          actor: {},
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
      expect(event.actor).to.deep.eq({ key: 'actor' });
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
          actor: {},
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
      expect(event.actor).to.deep.eq({ key: 'actor' });
      expect(eventHash).to.eq(hash(event));

      expect(process.current.key).to.eq('second');
      expect(process.current.timestamp.toISOString()).to.eq(process.events[1].timestamp.toISOString());
    });

    it('should pick the transition based on the actor', () => {
      const scenario = normalize({
        title: 'some scenario',
        actors: {
          actor: {},
          admin: {},
        },
        states: {
          initial: {
            transitions: [
              { on: 'complete', by: 'actor', goto: '(failed)' },
              { on: 'complete', by: 'admin', goto: '(done)' },
            ],
          },
        },
      });

      const instructions = {
        scenario: uuid(scenario),
        actors: {
          actor: {},
          admin: {},
        },
      };

      const newProcess = instantiate(scenario, instructions);
      const process = step(newProcess, 'complete', 'admin');

      expect(process.current.key).to.eq('(done)');
    });

    it('should pick the transition based on the actor with wildcard', () => {
      const scenario = normalize({
        title: 'some scenario',
        actors: {
          'party_*': {},
          admin: {},
        },
        states: {
          initial: {
            transitions: [
              { on: 'complete', by: 'admin', goto: '(failed)' },
              { on: 'complete', by: 'party_*', goto: '(done)' },
            ],
          },
        },
      });

      const instructions = {
        scenario: uuid(scenario),
        actors: {
          party_1: {},
          party_2: {},
          admin: {},
        },
      };

      const newProcess = instantiate(scenario, instructions);
      const process = step(newProcess, 'complete', 'party_2');

      expect(process.current.key).to.eq('(done)');
    });

    it('should pick the transition based on the if condition', () => {
      const scenario = normalize({
        title: 'some scenario',
        vars: {
          foo: 'integer',
        },
        states: {
          initial: {
            transitions: [
              { on: 'complete', if: { '<ref>': 'vars.foo <= 10' }, goto: '(failed)' },
              { on: 'complete', if: { '<ref>': 'vars.foo > 10' }, goto: '(done)' },
            ],
          },
        },
      });

      const instructions = {
        scenario: uuid(scenario),
        actors: {
          actor: {},
        },
        vars: {
          foo: 42,
        },
      };

      const newProcess = instantiate(scenario, instructions);
      const process = step(newProcess, 'complete', 'actor');

      expect(process.current.key).to.eq('(done)');
    });

    it('should stay in the current state', () => {
      const scenario = normalize({
        title: 'some scenario',
        states: {
          initial: {
            transitions: [
              { on: 'complete', goto: '(done)' },
              { on: 'nop', goto: null },
            ],
          },
        },
      });

      const instructions = {
        scenario: uuid(scenario),
        actors: {
          actor: {},
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
      expect(event.actor).to.deep.eq({ key: 'actor' });
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
          actor: {},
        },
      };

      const newProcess = instantiate(scenario, instructions);
      const process = step(newProcess, 'complete', 'actor');

      expect(() => step(process, 'complete', 'actor')).to.throw("Process is in end state '(done)'");
    });

    it("should skip an action that's not allowed in the state", () => {
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
          actor: {},
        },
      };

      const newProcess = instantiate(scenario, instructions);
      const process = step(newProcess, 'dance', 'actor');

      expect(process.current.key).to.eq('initial');
      expect(process.events).to.have.length(2);

      const event = process.events[1] as ActionEvent;
      expect(event.timestamp).to.be.instanceof(Date);
      expect(event.previous).to.eq(process.events[0].hash);
      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq("Action 'dance' is not allowed in state 'initial'");
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
        user: {},
      },
    };

    it('should check if an actor is defined', () => {
      const process = step(instantiate(scenario, instructions), 'complete', 'captain');
      const event = process.events[1] as ActionEvent;

      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq("Actor 'captain' is not defined in the scenario");
    });

    it('should check if an actor is assigned', () => {
      const process = step(instantiate(scenario, instructions), 'complete', { key: 'admin', id: '1' });
      const event = process.events[1] as ActionEvent;

      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq("Actor 'admin' is not assigned to a user or role");
    });

    it('should check if an actor is allowed to perform an action', () => {
      const process = step(instantiate(scenario, instructions), 'complete', 'user');
      const event = process.events[1] as ActionEvent;

      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq("Actor 'user' is not allowed to perform action 'complete'");
    });

    it('should allow an actor to perform an action based on the id', () => {
      const newProcess = instantiate(scenario, {
        scenario: uuid(scenario),
        actors: {
          admin: { id: 'eb82534d-1b99-415f-8d32-096070ea3310' },
        },
      });

      const process = step(newProcess, 'complete', { key: 'admin', id: 'eb82534d-1b99-415f-8d32-096070ea3310' });

      expect(process.current.key).to.eq('(done)');
    });

    it('should allow an actor to perform an action based on the role', () => {
      const newProcess = instantiate(scenario, {
        scenario: uuid(scenario),
        actors: {
          admin: { role: 'administrator' },
        },
      });

      const actor = { key: 'admin', id: 'eb82534d-1b99-415f-8d32-096070ea3310', roles: ['administrator'] };
      const process = step(newProcess, 'complete', actor);

      expect(process.current.key).to.eq('(done)');
    });
  });

  describe('update instructions', () => {
    it('should apply update instructions', () => {
      const scenario = normalize({
        title: 'some scenario',
        actors: {
          client: {},
        },
        actions: {
          complete: {
            update: [
              { set: 'title', data: 'updated title' },
              { set: 'actors.client.title', data: 'Updated actor' },
              { set: 'vars.foo', data: 'bar' },
              { set: 'result', data: 42 },
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
          client: { id: 'eb82534d-1b99-415f-8d32-096070ea3310' },
        },
      };

      const newProcess = instantiate(scenario, instructions);
      const process = step(newProcess, 'complete', 'client');

      expect(process.current.key).to.eq('(done)');
      expect(process.title).to.eq('updated title');
      expect(process.actors.client).to.deep.eq({
        title: 'Updated actor',
        id: 'eb82534d-1b99-415f-8d32-096070ea3310',
      });
      expect(process.vars.foo).to.eq('bar');
    });

    it('should apply update instructions to the current actor using the response', () => {
      const scenario = normalize({
        title: 'some scenario',
        actors: {
          client: {},
        },
        actions: {
          complete: {
            update: [{ set: 'current.actor.title', data: { '<ref>': 'current.response.title' } }],
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
          client: { id: 'eb82534d-1b99-415f-8d32-096070ea3310' },
        },
      };

      const newProcess = instantiate(scenario, instructions);
      const process = step(newProcess, 'complete', 'client', { title: 'Updated actor' });

      expect(process.current.key).to.eq('(done)');
      expect(process.actors.client).to.deep.eq({
        title: 'Updated actor',
        id: 'eb82534d-1b99-415f-8d32-096070ea3310',
      });
    });

    it('should implicitly use the response', () => {
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
          actor: {},
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
          actor: {},
        },
      };

      const newProcess = instantiate(scenario, instructions);
      expect(() => step(newProcess, 'complete', 'actor')).to.throw(
        "Not allowed to set 'current.key' through update instructions",
      );
    });
  });

  describe('validate process after update', () => {
    const scenario = normalize({
      title: 'some scenario',
      actors: {
        client: {
          properties: {
            email: { type: 'string', pattern: '^\\w+@\\w+\\.\\w+$' },
            age: { type: 'integer' },
          },
        },
      },
      actions: {
        updateTitle: {
          update: { set: 'title' },
        },
        updateActor: {
          update: { set: 'current.actor' },
        },
        updateVars: {
          update: { set: 'vars.foo' },
        },
        updateResult: {
          update: { set: 'result' },
        },
      },
      vars: {
        foo: 'string',
      },
      result: {
        type: 'array',
        items: 'string',
      },
      states: {
        initial: {
          transitions: [
            { on: 'updateTitle', goto: '(done)' },
            { on: 'updateActor', goto: '(done)' },
            { on: 'updateVars', goto: '(done)' },
            { on: 'updateResult', goto: '(done)' },
          ],
        },
      },
    });

    const instructions = {
      scenario: uuid(scenario),
      actors: {
        client: {},
      },
    };

    const newProcess = instantiate(scenario, instructions);

    it('should validate the title', () => {
      const process = step(newProcess, 'updateTitle', 'client', { foo: 'bar' });
      const event = process.events[1] as ActionEvent;

      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq('Title is invalid: must be a string');
    });

    it('should validate the actor', () => {
      const process = step(newProcess, 'updateActor', 'client', { email: 'non-an-email', age: 'old' });
      const event = process.events[1] as ActionEvent;

      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq(
        `Actor 'client' is invalid: data/email must match pattern "^\\w+@\\w+\\.\\w+$", data/age must be integer`,
      );
    });

    it('should validate the vars', () => {
      const process = step(newProcess, 'updateVars', 'client', 42);
      const event = process.events[1] as ActionEvent;

      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq("Variable 'foo' is invalid: data must be string");
    });

    it('should validate the result', () => {
      const process = step(newProcess, 'updateResult', 'client', [42]);
      const event = process.events[1] as ActionEvent;

      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq('Result is invalid: data/0 must be string');
    });
  });
});
