import ajvFormats from 'ajv-formats';
import Ajv from 'ajv/dist/2020';
import { expect } from 'chai';
import { uuid } from '../../src';
import { hash, HashFn, instantiate, InstantiateEvent, Process, step } from '../../src/process';
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
      expect(event.scenario).to.eq('537d0f13-c01c-5273-8dfb-ba7e8328579d');
      expect(eventHash).to.eq(hash(event));

      expect(process.current.key).to.eq('initial');
      expect(process.current.title).to.eq('initial');
      expect(process.current.timestamp).to.eq(event.timestamp);
      expect(process.current.actions).to.have.length(1);
      expect(process.current.actions[0]).to.deep.eq({
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

      expect(process.actors).to.deep.eq({
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

    beforeEach(() => {
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
    });

    beforeEach(() => {
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
            trigger: null,
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

      const current = instantiateState(process, 'next', timestamp);

      expect(current.key).to.eq('next');
      expect(current.title).to.eq('Next state');
      expect(current.description).to.eq('Complete by John Doe');
      expect(current.timestamp).to.eq(timestamp);

      expect(current.instructions).to.have.key('client');
      expect(current.instructions.client).to.eq('Hello John Doe');

      expect(current.actions).to.have.length(1);
      expect(current.actions[0]).to.deep.eq({
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
            trigger: null,
          },
        ],
      };

      const current = instantiateState(process, 'next');

      expect(current.notify).to.have.length(0);
    });

    it('should group actions by on', () => {
      scenario.actors.admin = {};
      scenario.actors.management = {};
      scenario.actors.notary = {};
      scenario.actors.other = {};

      scenario.states.next = {
        ...scenario.states.next,
        transitions: [
          {
            on: 'complete',
            by: ['admin', 'management'],
            if: true,
            goto: '(a)',
          },
          {
            on: 'complete',
            by: ['client', 'management'],
            if: true,
            goto: '(b)',
          },
          {
            on: 'complete',
            by: ['notary'],
            if: false,
            goto: '(c)',
          },
        ],
      };

      process = instantiate(scenario, { ajv });
      const current = instantiateState(process, 'next');

      expect(current.actions).to.have.length(1);
      expect(current.actions[0].actor).to.deep.eq(['client', 'admin', 'management']);
    });

    it('should move through multiple states when using null actions', () => {
      const scenario = normalize({
        title: 'some scenario',
        states: {
          initial: { on: null, goto: 'a' },
          a: { on: null, goto: 'b', log: { title: 'O~O' } },
          b: {
            transitions: [
              { on: null, goto: '(failed)', if: false },
              { on: null, goto: 'last', log: { title: '>:)' } },
            ],
          },
          last: { on: 'complete', goto: '(done)' },
        },
      });

      const process = instantiate(scenario);

      expect(process.current.key).to.eq('last');
      expect(process.events).to.have.length(1);
      expect(process.previous.map((p) => p.title)).to.deep.eq(['O~O', '>:)']);
    });
  });

  describe('action', () => {
    let scenario: NormalizedScenario;
    let processOnlyAdmin: Process;
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
          initial: {},
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
      processOnlyAdmin = instantiate(scenario, { ajv });

      process = step(processOnlyAdmin, 'set_actors', 'admin', {
        client_1: { title: 'client 1' },
        client_2: { title: 'client 2' },
      });
      expect(Object.keys(process.actors)).to.deep.eq(['admin', 'client_1', 'client_2']);
    });

    it('should instantiate an action', () => {
      const action = instantiateAction(process, 'one');

      expect(action).to.deep.eq({
        title: 'one',
        description: 'Complete some scenario',
        if: false,
        actor: ['admin'],
        response: {},
        key: 'one',
      });
    });

    it('should instantiate an action with a wildcard actor', () => {
      const action = instantiateAction(process, 'two');

      expect(action).to.deep.eq({
        title: 'two',
        description: '',
        actor: ['client_1', 'client_2'],
        if: true,
        response: {},
        key: 'two',
      });
    });

    it('should set the actor to all actors if the actor is a wildcard', () => {
      const action = instantiateAction(process, 'three');

      expect(action).to.deep.eq({
        title: 'three',
        description: '',
        actor: ['admin', 'client_1', 'client_2'],
        if: true,
        response: {},
        key: 'three',
      });
    });

    it('should filter on by', () => {
      const action = instantiateAction(process, 'three', undefined, ['admin', 'client_1', 'foo']);

      expect(action).to.deep.eq({
        title: 'three',
        description: '',
        actor: ['admin', 'client_1'],
        if: true,
        response: {},
        key: 'three',
      });
    });

    it('should filter on by with a wildcard actor', () => {
      const action = instantiateAction(process, 'three', undefined, ['client_*']);

      expect(action).to.deep.eq({
        title: 'three',
        description: '',
        actor: ['client_1', 'client_2'],
        if: true,
        response: {},
        key: 'three',
      });
    });

    it('should not filter on if by contains any', () => {
      const action = instantiateAction(process, 'three', undefined, ['admin', '*']);

      expect(action).to.deep.eq({
        title: 'three',
        description: '',
        actor: ['admin', 'client_1', 'client_2'],
        if: true,
        response: {},
        key: 'three',
      });
    });
  });

  describe('options', () => {
    const scenario = normalize({
      states: {
        initial: {
          on: 'complete',
          goto: '(done)',
        },
      },
    });

    it('should use the hashFn', () => {
      const hash = 'some-hash';
      const hashFn: HashFn = <T>(data: Omit<T, 'hash'>) => ({ ...data, hash }) as T;

      const process = instantiate(scenario, { hashFn, ajv });

      expect(process.events[0].hash).to.eq(hash);
    });

    it('should use the idFn', () => {
      const id = 'some-id';
      const idFn = () => id;

      const process = instantiate(scenario, { idFn, ajv });

      expect(process.id).to.eq(id);
    });
  });
});
