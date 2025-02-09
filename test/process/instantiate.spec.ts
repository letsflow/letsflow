import ajvFormats from 'ajv-formats';
import Ajv from 'ajv/dist/2020';
import { expect } from 'chai';
import { uuid } from '../../src';
import { instantiate, InstantiateEvent, Process, step } from '../../src/process';
import { hash } from '../../src/process/hash';
import { instantiateAction, instantiateState } from '../../src/process/instantiate';
import { normalize, NormalizedScenario } from '../../src/scenario';
import { actionSchema, actorSchema, fnSchema, scenarioSchema, schemaSchema } from '../../src/schemas/v1.0';

describe('instantiate', () => {
  let ajv: Ajv;

  const clientSchema = {
    $id: 'https://schemas.example.com/actors/client',
    type: 'object',
    properties: {
      name: { type: 'string' },
      signed: { type: 'boolean', default: false },
      status: { type: 'string', default: 'active' },
    },
  };
  const contractSchema = {
    $id: 'https://schemas.example.com/objects/contract',
    type: 'object',
    properties: {
      amount: { type: 'number', default: 0 },
      signed: { type: 'boolean', default: false },
    },
    $defs: {
      meta: {
        type: 'object',
        properties: {
          created: { type: 'string', format: 'date-time' },
          approved: { type: 'boolean', default: false },
        },
      },
    },
  };

  beforeEach(() => {
    ajv = new Ajv({ allErrors: true });
    ajv.addKeyword('$anchor');
    ajv.addSchema([scenarioSchema, actionSchema, actorSchema, fnSchema, schemaSchema, clientSchema, contractSchema]);
    ajvFormats(ajv);
  });

  describe('instantiate', () => {
    it('should instantiate', () => {
      const scenario: NormalizedScenario = normalize({
        title: 'some scenario',
        actions: {
          complete: {
            description: { '<tpl>': 'Complete {{scenario.title}}' },
          },
        },
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
          },
        },
      });

      const process = instantiate(scenario, { ajv });

      expect(process.scenario).to.deep.eq({ id: uuid(scenario), ...scenario });
      expect(process.actors).to.deep.eq({
        actor: { title: 'actor' },
      });
      expect(process.vars).to.deep.eq({});

      expect(process.events.length).to.eq(1);
      const { hash: eventHash, ...event } = process.events[0] as InstantiateEvent;
      expect(event.timestamp).to.be.instanceof(Date);
      expect(event.scenario).to.eq('b6068b54-e9b4-5c74-a084-b0c2b88a05c4');
      expect(event.actors).to.deep.eq({
        actor: { title: 'actor' },
      });
      expect(event.vars).to.deep.eq({});
      expect(eventHash).to.eq(hash(event));

      expect(process.current.key).to.eq('initial');
      expect(process.current.title).to.eq('initial');
      expect(process.current.timestamp).to.eq(event.timestamp);
      expect(process.current.actions).to.have.length(1);
      expect(process.current.actions[0]).to.deep.eq({
        $schema: 'https://schemas.letsflow.io/v1.0/action',
        title: 'complete',
        description: 'Complete some scenario',
        actor: ['actor'],
        response: {},
        key: 'complete',
      });
    });

    it('should instantiate actors', () => {
      const scenario: NormalizedScenario = normalize({
        actors: {
          user: {
            title: 'Main user',
            properties: {
              name: { type: 'string' },
              verified: { type: 'boolean', default: false },
            },
          },
          admin: null,
          support: {
            role: 'support-team',
          },
          'signer_*': {},
        },
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
          },
        },
      });

      const process = instantiate(scenario, { ajv });

      expect(process.actors.user).to.deep.eq({
        title: 'Main user',
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

      expect((process.events[0] as InstantiateEvent).actors).to.deep.eq({
        user: {
          title: 'Main user',
          verified: false,
        },
        admin: {
          title: 'admin',
        },
        support: {
          title: 'support',
          role: 'support-team',
        },
      });
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
          foo: { const: 'hello' },
          bar: { type: 'integer', default: 10 },
          qux: {
            type: 'object',
            description: 'Ignored because no defaults',
            properties: {
              one: 'string',
              two: 'number',
            },
          },
        },
      });

      const process = instantiate(scenario, { ajv });

      expect(process.vars).to.deep.eq({
        foo: 'hello',
        bar: 10,
      });

      expect((process.events[0] as InstantiateEvent).vars).to.deep.eq({
        foo: 'hello',
        bar: 10,
      });
    });

    it('should instantiate result', () => {
      const scenario: NormalizedScenario = normalize({
        result: {
          properties: {
            amount: { type: 'number', default: 0 },
            signed: { type: 'boolean', default: false },
          },
        },
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
          },
        },
      });

      const process = instantiate(scenario, { ajv });

      expect(process.result).to.deep.eq({
        amount: 0,
        signed: false,
      });

      expect((process.events[0] as InstantiateEvent).result).to.deep.eq({
        amount: 0,
        signed: false,
      });
    });

    it('should get default values with refs', () => {
      const scenario: NormalizedScenario = normalize({
        actors: {
          client: {
            $ref: 'https://schemas.example.com/actors/client',
          },
        },
        result: 'https://schemas.example.com/objects/contract#/$defs/meta',
        vars: {
          foo: {
            properties: {
              one: '#/$defs/bool',
              two: '#/$defs/bool',
            },
            $defs: {
              bool: { type: 'boolean', default: false },
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

      const process = instantiate(scenario, { ajv });

      expect(process.actors).to.deep.eq({
        client: {
          title: 'client',
          signed: false,
          status: 'active',
        },
      });

      expect(process.vars).to.deep.eq({
        foo: {
          one: false,
          two: false,
        },
      });

      expect(process.result).to.deep.eq({
        approved: false,
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
              name: {
                type: 'string',
                default: 'John Doe',
              },
              email: {
                type: 'string',
                default: 'john@example.com',
              },
            },
          },
        },
        actions: {
          complete: {
            description: { '<tpl>': 'Complete {{scenario.title}}' },
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

      process = instantiate(scenario, { ajv });
    });

    it('should instantiate a state', () => {
      scenario.states.next = {
        title: 'Next state',
        description: { '<tpl>': 'Complete by {{actors.client.name}}' },
        instructions: {
          client: { '<tpl>': 'Hello {{actors.client.name}}' },
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
              body: { '<tpl>': 'Welcome {{actors.client.name}}' },
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
        $schema: 'https://schemas.letsflow.io/v1.0/action',
        title: 'complete',
        description: 'Complete some scenario',
        actor: ['client'],
        response: {},
        key: 'complete',
      });

      expect(current.notify).to.have.length(1);
      expect(current.notify[0]).to.deep.eq({
        service: 'email',
        after: 0,
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
          'client_*': {},
          admin: {},
        },
        actions: {
          set_actors: {
            update: {
              set: 'actors',
              mode: 'merge',
            },
          },
          one: {
            description: { '<tpl>': 'Complete {{scenario.title}}' },
            actor: { '<ref>': 'vars.act' },
            if: { '<ref>': 'vars.amount > 100' },
          },
          two: {
            actor: 'client_*',
          },
          three: {
            actor: ['*'],
          },
        },
        states: {
          '*': {
            on: 'set_actors',
            goto: null,
          },
          initial: {
            transitions: [
              {
                on: 'complete',
                goto: '(done)',
              },
              {
                on: 'other',
                goto: '(done)',
              },
            ],
          },
        },
        vars: {
          act: {
            type: 'string',
            default: 'admin',
          },
          amount: {
            type: 'integer',
            default: 20,
          },
        },
      });
    });

    beforeEach(() => {
      process = instantiate(scenario, { ajv });
    });

    it('should instantiate an action', () => {
      const action = instantiateAction('one', scenario.actions['one'], process);

      expect(action).to.deep.eq({
        $schema: 'https://schemas.letsflow.io/v1.0/action',
        title: 'one',
        description: 'Complete some scenario',
        if: false,
        actor: ['admin'],
        response: {},
        key: 'one',
      });
    });

    it('should instantiate an action with a wildcard actor', () => {
      process = step(process, 'set_actors', 'admin', {
        client_1: { title: 'client 1' },
        client_2: { title: 'client 2' },
      });
      expect(Object.keys(process.actors)).to.deep.eq(['admin', 'client_1', 'client_2']);

      const action = instantiateAction('two', scenario.actions['two'], process);

      expect(action).to.deep.eq({
        $schema: 'https://schemas.letsflow.io/v1.0/action',
        title: 'two',
        description: '',
        actor: ['client_1', 'client_2'],
        if: true,
        response: {},
        key: 'two',
      });
    });

    it('should set the if condition to false if the actor is not found', () => {
      const action = instantiateAction('two', scenario.actions['two'], process);

      expect(action).to.deep.eq({
        $schema: 'https://schemas.letsflow.io/v1.0/action',
        title: 'two',
        description: '',
        actor: [],
        if: false,
        response: {},
        key: 'two',
      });
    });

    it('should set the actor to all actors if the actor is a wildcard', () => {
      process = step(process, 'set_actors', 'admin', {
        client_1: { title: 'client 1' },
        client_2: { title: 'client 2' },
      });
      expect(Object.keys(process.actors)).to.deep.eq(['admin', 'client_1', 'client_2']);

      const action = instantiateAction('three', scenario.actions['three'], process);

      expect(action).to.deep.eq({
        $schema: 'https://schemas.letsflow.io/v1.0/action',
        title: 'three',
        description: '',
        actor: ['admin', 'client_1', 'client_2'],
        if: true,
        response: {},
        key: 'three',
      });
    });
  });
});
