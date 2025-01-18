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
      expect(event.errors).to.be.undefined;
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

      let process = instantiate(scenario, instructions);
      process = step(process, 'complete', 'actor');
      process = step(process, 'complete', 'actor');

      const event = process.events[2] as ActionEvent;
      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq("Action 'complete' is not allowed in state '(done)'");
    });

    it('should skip an actions that is undefined', () => {
      const scenario = normalize({
        title: 'some scenario',
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
          },
        },
      });

      const instructions = {
        scenario: uuid(scenario),
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

    it('should skip an action that is not allowed by if condition', () => {
      const scenario = normalize({
        title: 'some scenario',
        vars: {
          foo: 'integer',
        },
        actions: {
          complete: {
            if: { '<ref>': 'vars.foo > 10' },
          },
        },
        states: {
          initial: {
            transitions: [{ on: 'complete', goto: '(done)' }],
          },
        },
      });

      const instructions = {
        scenario: uuid(scenario),
        vars: {
          foo: 5,
        },
      };

      const newProcess = instantiate(scenario, instructions);
      const process = step(newProcess, 'complete', 'actor');

      expect(process.current.key).to.eq('initial');
      expect(process.events).to.have.length(2);

      const event = process.events[1] as ActionEvent;
      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq("Action 'complete' is not allowed due to if condition");
    });
  });

  describe('response', () => {
    const scenario = normalize({
      title: 'some scenario',
      actions: {
        complete: {
          response: 'string',
        },
      },
      states: {
        initial: {
          on: 'complete',
          goto: '(done)',
        },
      },
    });

    it('should step to the next state if the response is valid', () => {
      const instructions = {
        scenario: uuid(scenario),
      };

      const newProcess = instantiate(scenario, instructions);
      const process = step(newProcess, 'complete', 'actor', 'hello world');

      expect(process.current.key).to.eq('(done)');
    });

    it('should skip the action if the response is invalid', () => {
      const instructions = {
        scenario: uuid(scenario),
      };

      const newProcess = instantiate(scenario, instructions);
      const process = step(newProcess, 'complete', 'actor', { foo: 'bar' });

      expect(process.current.key).to.eq('initial');
      expect(process.events).to.have.length(2);

      const event = process.events[1] as ActionEvent;
      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq('Response is invalid: data must be string');
    });

    it('should use the default response if no response is set', () => {
      const scenario = normalize({
        title: 'some scenario',
        actions: {
          complete: {
            response: {
              type: 'string',
              default: 'default value',
            },
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
      };

      const newProcess = instantiate(scenario, instructions);
      const process = step(newProcess, 'complete', 'actor');

      const event = process.events[1] as ActionEvent;
      expect(event.response).to.eq('default value');
    });

    it('should not use the default response if the response is set', () => {
      const scenario = normalize({
        title: 'some scenario',
        actions: {
          complete: {
            response: {
              type: 'string',
              default: 'default value',
            },
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
      };

      const newProcess = instantiate(scenario, instructions);
      const process = step(newProcess, 'complete', 'actor', 'hello world');

      const event = process.events[1] as ActionEvent;
      expect(event.response).to.eq('hello world');
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

    it('should put additional actor properties in the event', () => {
      const scenario = normalize({
        actors: {
          admin: {
            role: 'administrator',
            properties: {
              name: 'string',
              email: 'string',
            },
          },
        },
        actions: {
          complete: {
            update: {
              set: 'current.actor',
              mode: 'merge',
              value: { '<ref>': 'events[-1].actor | { id: id, name: name, email: email }' },
            },
          },
        },
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
          },
        },
      });

      const newProcess = instantiate(scenario, {
        scenario: uuid(scenario),
        actors: {
          admin: {
            title: 'Captain',
          },
        },
      });

      const actor = {
        key: 'admin',
        id: 'eb82534d-1b99-415f-8d32-096070ea3310',
        roles: ['administrator'],
        name: 'John',
        email: 'john@example.com',
      };

      const process = step(newProcess, 'complete', actor);

      const event = process.events[1] as ActionEvent;
      expect(event.actor).to.deep.eq({
        key: 'admin',
        id: 'eb82534d-1b99-415f-8d32-096070ea3310',
        name: 'John',
        email: 'john@example.com',
      });

      expect(process.current.key).to.eq('(done)');
      expect(process.actors.admin).to.deep.eq({
        id: 'eb82534d-1b99-415f-8d32-096070ea3310',
        name: 'John',
        email: 'john@example.com',
        role: 'administrator',
        title: 'Captain',
      });
    });
  });

  describe('notify service', () => {
    it('should allow a service to trigger an action', () => {
      const scenario = normalize({
        states: {
          initial: {
            notify: {
              service: 'my-app',
              trigger: 'complete',
            },
            on: 'complete',
            goto: '(done)',
          },
        },
      });

      const instructions = {
        scenario: uuid(scenario),
      };

      const process = step(instantiate(scenario, instructions), 'complete', 'service:my-app');

      expect(process.current.key).to.eq('(done)');
    });

    it('should not allow a service to perform action without a trigger', () => {
      const scenario = normalize({
        states: {
          initial: {
            notify: {
              service: 'my-app',
            },
            on: 'complete',
            goto: '(done)',
          },
        },
      });

      const instructions = {
        scenario: uuid(scenario),
      };

      const process = step(instantiate(scenario, instructions), 'complete', 'service:my-app');
      const event = process.events[1] as ActionEvent;

      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq("Service 'my-app' is not expected to trigger action 'complete'");
    });

    it('should not allow a service to trigger an action when the notification is disabled', () => {
      const scenario = normalize({
        states: {
          initial: {
            notify: {
              service: 'my-app',
              trigger: 'complete',
              if: false,
            },
            on: 'complete',
            goto: '(done)',
          },
        },
      });

      const instructions = {
        scenario: uuid(scenario),
      };

      const process = step(instantiate(scenario, instructions), 'complete', 'service:my-app');
      const event = process.events[1] as ActionEvent;

      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq("Service 'my-app' is not expected to trigger action 'complete'");
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
              { set: 'title', value: 'updated title' },
              { set: 'actors.client.title', value: 'Updated actor' },
              { set: 'vars.foo', value: 'bar' },
              { set: 'result', value: 42 },
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
            update: [{ set: 'current.actor.title', value: { '<ref>': 'current.response.title' } }],
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
            update: { set: 'current.key', value: '(whoops)' },
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
