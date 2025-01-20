import ajvFormats from 'ajv-formats';
import Ajv from 'ajv/dist/2020';
import { expect } from 'chai';
import { instantiate, InstantiateEvent, Process } from '../../src/process';
import { hash } from '../../src/process/hash';
import { instantiateAction, instantiateState } from '../../src/process/instantiate';
import { normalize, NormalizedScenario } from '../../src/scenario';
import { actionSchema, actorSchema, fnSchema, scenarioSchema, schemaSchema } from '../../src/schemas/v1.0.0';

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

  describe('scenario', () => {
    it('should instantiate', () => {
      const scenarioId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
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

      const process = instantiate(
        scenario,
        {
          scenario: scenarioId,
          actors: {},
          vars: {},
        },
        { ajv },
      );

      expect(process.scenario).to.deep.eq({ id: scenarioId, ...scenario });
      expect(process.actors).to.deep.eq({
        actor: { title: 'actor' },
      });
      expect(process.vars).to.deep.eq({});

      expect(process.events.length).to.eq(1);
      const { hash: eventHash, ...event } = process.events[0] as InstantiateEvent;
      expect(event.timestamp).to.be.instanceof(Date);
      expect(event.scenario).to.eq('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
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

      const process = instantiate(
        scenario,
        {
          scenario: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          actors: {
            user: { id: 'eb82534d-1b99-415f-8d32-096070ea3310' },
          },
          vars: {},
        },
        { ajv },
      );

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

      expect((process.events[0] as InstantiateEvent).actors).to.deep.eq({
        user: {
          title: 'Main user',
          id: 'eb82534d-1b99-415f-8d32-096070ea3310',
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
          foo: 'string',
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

      const process = instantiate(
        scenario,
        {
          scenario: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          actors: {},
          vars: {
            foo: 'hello',
          },
        },
        { ajv },
      );

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

      const process = instantiate(
        scenario,
        {
          scenario: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        },
        { ajv },
      );

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

      const process = instantiate(
        scenario,
        {
          scenario: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        },
        { ajv },
      );

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

    it('should go into an error state if validation fails', () => {
      const scenario: NormalizedScenario = normalize({
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
          },
        },
        vars: {
          amount: 'integer',
        },
      });

      const process = instantiate(
        scenario,
        {
          scenario: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          vars: {
            amount: 'not a number',
          },
        },
        { ajv },
      );

      expect(process.current).to.deep.eq({
        key: '(error)',
        title: 'Error',
        description: 'The process failed to start',
        instructions: {},
        actions: [],
        notify: [],
        timestamp: process.events[0].timestamp,
      });

      const event = process.events[0] as InstantiateEvent;

      expect(event.errors ?? []).to.have.length(1);
      expect(event.errors![0]).to.eq("Variable 'amount' is invalid: data must be integer");
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

    before(() => {
      process = instantiate(
        scenario,
        {
          scenario: 'basic',
          actors: {
            client: {
              name: 'John Doe',
              email: 'john@example.com',
            },
          },
        },
        { ajv },
      );
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
          admin: {},
        },
        actions: {
          complete: {
            description: { '<tpl>': 'Complete {{scenario.title}}' },
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
            default: 'client',
          },
          amount: 'integer',
        },
      });
    });

    before(() => {
      process = instantiate(
        scenario,
        {
          scenario: 'basic',
          vars: {
            amount: 20,
            act: 'admin',
          },
        },
        { ajv },
      );
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
