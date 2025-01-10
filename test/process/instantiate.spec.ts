import { expect } from 'chai';
import { instantiate, InstantiateEvent, Process } from '../../src/process';
import { hash } from '../../src/process/hash';
import { instantiateAction, instantiateState } from '../../src/process/instantiate';
import { normalize, NormalizedScenario } from '../../src/scenario';

describe('instantiate', () => {
  describe('scenario', () => {
    it('should instantiate', () => {
      const scenarioId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      const scenario: NormalizedScenario = normalize({
        title: 'some scenario',
        actions: {
          complete: {
            description: { '<sub>': 'Complete ${scenario.title}' },
          },
        },
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
          },
        },
      });

      const process = instantiate(scenario, {
        scenario: scenarioId,
        actors: {},
        vars: {},
      });

      expect(process.scenario).to.deep.eq({ id: scenarioId, ...scenario });
      expect(process.actors).to.deep.eq({
        actor: { title: 'actor' },
      });
      expect(process.vars).to.deep.eq({});

      expect(process.events.length).to.eq(1);
      const { hash: eventHash, ...event } = process.events[0] as InstantiateEvent;
      expect(event.timestamp).to.be.instanceof(Date);
      expect(event.scenario).to.eq('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
      expect(event.actors).to.deep.eq({});
      expect(event.vars).to.deep.eq({});
      expect(eventHash).to.eq(hash(event));

      expect(process.current.key).to.eq('initial');
      expect(process.current.title).to.eq('initial');
      expect(process.current.timestamp).to.eq(event.timestamp);
      expect(process.current.actions).to.have.length(1);
      expect(process.current.actions[0]).to.deep.eq({
        $schema: 'https://schemas.letsflow.io/v1.0.0/action',
        title: 'complete',
        description: 'Complete some scenario',
        if: true,
        actor: ['*'],
        response: {},
        key: 'complete',
      });
    });

    it('should instantiate actors', () => {
      const scenario: NormalizedScenario = normalize({
        title: 'some scenario',
        actors: {
          user: {
            title: 'Main user',
            properties: {
              name: { type: 'string' },
              verified: { type: 'boolean', default: false },
            },
          },
          admin: {},
          support: {
            role: 'support-team',
          },
          'signer_*': {},
        },
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

      const process = instantiate(scenario, {
        scenario: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        actors: {
          user: { id: 'eb82534d-1b99-415f-8d32-096070ea3310' },
        },
        vars: {},
      });

      expect(process.actors.user).to.deep.eq({
        title: 'Main user',
        id: 'eb82534d-1b99-415f-8d32-096070ea3310',
        verified: false,
      });

      expect(process.actors.admin).to.deep.eq({
        title: 'admin',
      });

      expect(process.actors.support).to.deep.eq({
        title: 'support',
        role: 'support-team',
      });

      expect(Object.keys(process.actors)).to.deep.eq(['user', 'admin', 'support']);
    });

    it('should instantiate vars', () => {
      const scenario: NormalizedScenario = normalize({
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
        vars: {
          foo: { type: 'string' },
          bar: { type: 'integer', default: 10 },
          qux: { type: 'string' },
        },
      });

      const process = instantiate(scenario, {
        scenario: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        actors: {},
        vars: {
          foo: 'hello',
        },
      });

      expect(process.vars).to.deep.eq({
        foo: 'hello',
        bar: 10,
      });
    });
  });

  describe('state', () => {
    let scenario: NormalizedScenario;
    let process: Process;

    before(() => {
      scenario = normalize({
        title: 'some scenario',
        actors: {
          client: {
            properties: {
              name: 'string',
              email: 'string',
            },
          },
        },
        actions: {
          complete: {
            description: { '<sub>': 'Complete ${scenario.title}' },
          },
          other: {
            if: false,
          },
        },
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
          },
        },
        foo: 10,
      });
    });

    before(() => {
      process = instantiate(scenario, {
        scenario: 'basic',
        actors: {
          client: {
            name: 'John Doe',
            email: 'john@example.com',
          },
        },
      });
    });

    it('should instantiate a state', () => {
      scenario.states.next = {
        title: 'Next state',
        description: { '<sub>': 'Complete by ${actors.client.name}' },
        instructions: {
          client: { '<sub>': 'Hello ${actors.client.name}' },
        },
        actions: ['complete', 'other'],
        transitions: [
          {
            on: 'complete',
            by: ['*'],
            if: true,
            goto: '(done)',
          },
        ],
        notify: [
          {
            service: 'email',
            after: 0,
            if: true,
            message: {
              recipient: { '<ref>': 'actors.client' },
              body: { '<sub>': 'Welcome ${actors.client.name}' },
            },
          },
        ],
        foo: { '<ref>': 'scenario.foo' },
        bar: 'abc',
      };
      const timestamp = new Date();

      const current = instantiateState(scenario, 'next', process, timestamp);

      expect(current.key).to.eq('next');
      expect(current.title).to.eq('Next state');
      expect(current.description).to.eq('Complete by John Doe');
      expect(current.timestamp).to.eq(timestamp);

      expect(current.instructions).to.have.key('client');
      expect(current.instructions.client).to.eq('Hello John Doe');

      expect(current.actions).to.have.length(1);
      expect(current.actions[0]).to.deep.eq({
        $schema: 'https://schemas.letsflow.io/v1.0.0/action',
        title: 'complete',
        description: 'Complete some scenario',
        if: true,
        actor: ['*'],
        response: {},
        key: 'complete',
      });

      expect(current.notify).to.have.length(1);
      expect(current.notify[0]).to.deep.eq({
        service: 'email',
        after: 0,
        if: true,
        message: {
          recipient: {
            name: 'John Doe',
            email: 'john@example.com',
            title: 'client',
          },
          body: 'Welcome John Doe',
        },
      });

      expect(current.foo).to.eq(10);
      expect(current.bar).to.eq('abc');
    });

    it('should exclude a notify if condition is false', () => {
      scenario.states.next = {
        title: 'Next state',
        notify: [
          {
            service: 'email',
            after: 0,
            if: false,
          },
        ],
      };

      const current = instantiateState(scenario, 'next', process);

      expect(current.notify).to.have.length(0);
    });
  });

  describe('action', () => {
    let scenario: NormalizedScenario;
    let process: Process;

    before(() => {
      scenario = normalize({
        title: 'some scenario',
        actors: {
          client: {},
          admin: {}
        },
        actions: {
          complete: {
            description: { '<sub>': 'Complete ${scenario.title}' },
            actor: { '<ref>': 'vars.act' },
            if: { '<ref>': 'vars.amount > 100' },
          },
        },
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
          },
        },
        vars: {
          act: {
            type: 'string',
            default: 'client'
          },
          amount: 'integer'
        },
      });
    });

    before(() => {
      process = instantiate(scenario, {
        scenario: 'basic',
        vars: {
          amount: 20,
          act: 'admin'
        },
      });
    });

    it('should instantiate an action', () => {
      const action = instantiateAction('complete', scenario.actions['complete'], process);

      expect(action).to.deep.eq({
        $schema: 'https://schemas.letsflow.io/v1.0.0/action',
        title: 'complete',
        description: 'Complete some scenario',
        if: false,
        actor: ['admin'],
        response: {},
        key: 'complete',
      });
    });
  });
});
