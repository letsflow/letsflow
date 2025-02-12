import { expect } from 'chai';
import { uuid } from '../../src';
import { ActionEvent, chain, hash, instantiate, step } from '../../src/process';
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

      const process = step(instantiate(scenario), 'complete', 'actor');

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

      const process = step(instantiate(scenario), 'next', 'actor');

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

      const process = step(instantiate(scenario), 'complete', 'admin');

      expect(process.current.key).to.eq('(done)');
    });

    it('should pick the transition based on the actor with wildcard', () => {
      const scenario = normalize({
        actions: {
          createActors: {
            response: {
              patternProperties: {
                '^party_\\d+$': 'object',
              },
            },
            update: {
              set: 'actors',
              mode: 'merge',
            },
          },
        },
        actors: {
          'party_*': {},
          admin: {},
        },
        states: {
          initial: {
            on: 'createActors',
            goto: 'main',
          },
          main: {
            transitions: [
              { on: 'complete', by: 'admin', goto: '(failed)' },
              { on: 'complete', by: 'party_*', goto: '(done)' },
            ],
          },
        },
      });

      const process = chain(
        instantiate(scenario),
        (process) => step(process, 'createActors', 'admin', { party_1: {}, party_2: {} }),
        (process) => step(process, 'complete', 'party_2'),
      );

      expect(process.current.key).to.eq('(done)');
    });

    it('should pick the transition based on the if condition', () => {
      const scenario = normalize({
        title: 'some scenario',
        vars: {
          foo: 'integer',
        },
        actions: {
          setVar: {
            update: 'vars.foo',
          },
        },
        states: {
          initial: {
            transitions: [
              { on: 'setVar', goto: null },
              { on: 'complete', if: { '<ref>': 'vars.foo <= 10' }, goto: '(failed)' },
              { on: 'complete', if: { '<ref>': 'vars.foo > 10' }, goto: '(done)' },
            ],
          },
        },
      });

      const process = chain(
        instantiate(scenario),
        (process) => step(process, 'setVar', 'actor', 20),
        (process) => step(process, 'complete', 'actor'),
      );

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

      const initialProcess = instantiate(scenario);
      const process = step(initialProcess, 'nop', 'actor');

      expect(process.events).to.have.length(2);
      const { hash: eventHash, ...event } = process.events[1] as ActionEvent;
      expect(event.timestamp).to.be.instanceof(Date);
      expect(event.previous).to.eq(process.events[0].hash);
      expect(event.response).to.be.undefined;
      expect(event.action).to.eq('nop');
      expect(event.actor).to.deep.eq({ key: 'actor' });
      expect(eventHash).to.eq(hash(event));

      expect(process.current.key).to.eq('initial');
      expect(process.current.timestamp.toISOString()).to.eq(initialProcess.current.timestamp.toISOString());
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

      const process = chain(
        instantiate(scenario),
        (process) => step(process, 'complete', 'actor'),
        (process) => step(process, 'complete', 'actor'),
      );

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

      const process = step(instantiate(scenario), 'dance', 'actor');

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

      const process = step(instantiate(scenario), 'dance', 'actor');

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

      const process = step(instantiate(scenario), 'complete', 'actor');

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
      const process = step(instantiate(scenario), 'complete', 'actor', 'hello world');

      expect(process.current.key).to.eq('(done)');
    });

    it('should skip the action if the response is invalid', () => {
      const process = step(instantiate(scenario), 'complete', 'actor', { foo: 'bar' });

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

      const process = step(instantiate(scenario), 'complete', 'actor');

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

      const process = step(instantiate(scenario), 'complete', 'actor', 'hello world');

      const event = process.events[1] as ActionEvent;
      expect(event.response).to.eq('hello world');
    });
  });

  describe('actors', () => {
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
        setActor: {
          update: {
            set: 'current.actor',
            mode: 'merge',
          },
        },
      },
      states: {
        '*': {
          on: 'setActor',
          goto: null,
        },
        initial: {
          on: 'complete',
          goto: '(done)',
        },
      },
      vars: {
        foo: { type: 'string' },
      },
    });

    uuid(scenario);

    it('should check if an actor is defined', () => {
      const process = step(instantiate(scenario), 'complete', 'captain');
      const event = process.events[1] as ActionEvent;

      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq("Actor 'captain' is not defined in the scenario");
    });

    it('should check if an actor is assigned', () => {
      const process = step(instantiate(scenario), 'complete', { key: 'admin', id: '1' });
      const event = process.events[1] as ActionEvent;

      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq("Actor 'admin' is not assigned to a user or role");
    });

    it('should check if an actor is allowed to perform an action', () => {
      const process = step(instantiate(scenario), 'complete', 'user');
      const event = process.events[1] as ActionEvent;

      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq("Actor 'user' is not allowed to perform action 'complete'");
    });

    it('should allow an actor to perform an action based on the id', () => {
      const actor = { key: 'admin', id: 'eb82534d-1b99-415f-8d32-096070ea3310' };

      const process = chain(
        instantiate(scenario),
        (process) => step(process, 'setActor', 'admin', { id: 'eb82534d-1b99-415f-8d32-096070ea3310' }),
        (process) => step(process, 'complete', actor),
      );

      expect(process.current.key).to.eq('(done)');
    });

    it('should allow an actor to perform an action based on the role', () => {
      const actor = { key: 'admin', id: 'eb82534d-1b99-415f-8d32-096070ea3310', roles: ['administrator'] };

      const process = chain(
        instantiate(scenario),
        (process) => step(process, 'setActor', 'admin', { role: 'administrator' }),
        (process) => step(process, 'complete', actor),
      );

      expect(process.current.key).to.eq('(done)');
    });

    it('should put additional actor properties in the event', () => {
      const scenario = normalize({
        actors: {
          admin: {
            title: 'Captain',
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

      const actor = {
        key: 'admin',
        id: 'eb82534d-1b99-415f-8d32-096070ea3310',
        roles: ['administrator'],
        name: 'John',
        email: 'john@example.com',
      };

      const process = step(instantiate(scenario), 'complete', actor);

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

    it('should instantiate actors that are created at runtime', () => {
      const scenario = normalize({
        actors: {
          admin: {},
          'client_*': {
            properties: {
              name: 'string',
              email: 'string',
              signed: {
                type: 'boolean',
                default: false,
              },
            },
          },
        },
        actions: {
          complete: {
            response: {
              type: 'array',
              items: {
                properties: {
                  name: 'string',
                  email: 'string',
                },
              },
            },
            update: {
              set: 'actors',
              mode: 'merge',
              value: { '<ref>': "current.response | to_object(zip(range(1, length(@) + 1, 'client_'), @))" },
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

      const process = step(instantiate(scenario), 'complete', 'admin', [
        { name: 'Alice', email: 'alice@example.com' },
        { name: 'Bob', email: 'bob@example.com' },
        { name: 'Charlie', email: 'charlie@example.com' },
      ]);

      expect((process.events[process.events.length - 1] as ActionEvent).errors ?? []).to.deep.eq([]);
      expect(process.current.key).to.eq('(done)');

      expect(process.actors).to.deep.eq({
        admin: { title: 'admin' },
        client_1: { title: 'client 1', name: 'Alice', email: 'alice@example.com', signed: false },
        client_2: { title: 'client 2', name: 'Bob', email: 'bob@example.com', signed: false },
        client_3: { title: 'client 3', name: 'Charlie', email: 'charlie@example.com', signed: false },
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

      uuid(scenario);

      const process = step(instantiate(scenario), 'complete', 'service:my-app');

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

      uuid(scenario);

      const process = step(instantiate(scenario), 'complete', 'service:my-app');
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

      uuid(scenario);

      const process = step(instantiate(scenario), 'complete', 'service:my-app');
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

      const process = step(instantiate(scenario), 'complete', 'client');

      expect(process.current.key).to.eq('(done)');
      expect(process.title).to.eq('updated title');
      expect(process.actors.client).to.deep.eq({ title: 'Updated actor' });
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

      const process = step(instantiate(scenario), 'complete', 'client', { title: 'Updated actor' });

      expect(process.current.key).to.eq('(done)');
      expect(process.actors.client).to.deep.eq({
        title: 'Updated actor',
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

      const process = step(instantiate(scenario), 'complete', 'actor', 'bar');

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

      expect(() => step(instantiate(scenario), 'complete', 'actor')).to.throw(
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
        admin: {
          role: 'admin',
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
        updateAdminRole: {
          update: { set: 'actors.admin.role' },
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
            { on: 'updateAdminRole', goto: '(done)' },
          ],
        },
      },
    });

    const initialProcess = instantiate(scenario);

    it('should validate the title', () => {
      const process = step(initialProcess, 'updateTitle', 'client', { foo: 'bar' });
      const event = process.events[1] as ActionEvent;

      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq('Title is invalid: must be a string');
    });

    it('should validate the actor', () => {
      const process = step(initialProcess, 'updateActor', 'client', { email: 'non-an-email', age: 'old' });
      const event = process.events[1] as ActionEvent;

      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq(
        `Actor 'client' is invalid: data/email must match pattern "^\\w+@\\w+\\.\\w+$", data/age must be integer`,
      );
    });

    it('should validate the vars', () => {
      const process = step(initialProcess, 'updateVars', 'client', 42);
      const event = process.events[1] as ActionEvent;

      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq("Variable 'foo' is invalid: data must be string");
    });

    it('should validate the result', () => {
      const process = step(initialProcess, 'updateResult', 'client', [42]);
      const event = process.events[1] as ActionEvent;

      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq('Result is invalid: data/0 must be string');
    });

    it('should not allow modifying a fixed role', () => {
      const process = step(initialProcess, 'updateAdminRole', 'admin', 'client');
      const event = process.events[1] as ActionEvent;

      expect(event.skipped).to.be.true;
      expect(event.errors).to.have.length(1);
      expect(event.errors![0]).to.eq("Role of actor 'admin' must not be changed");
    });
  });
});
