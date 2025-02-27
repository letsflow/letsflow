import { expect } from 'chai';
import { normalize, Scenario, Schema } from '../../src/scenario';
import { schemaSchema } from '../../src/schemas/v1.0';

describe('normalize', () => {
  describe('scenario', () => {
    it('should normalize a minimal scenario', () => {
      const scenario: Scenario = {
        title: 'minimal scenario',
        tags: ['foo', 'bar'],
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
          },
        },
      };

      expect(normalize(scenario)).to.deep.eq({
        $schema: 'https://schemas.letsflow.io/v1.0/scenario',
        title: 'minimal scenario',
        description: '',
        tags: ['foo', 'bar'],
        actors: {
          actor: {
            title: 'actor',
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              role: {
                oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
              },
            },
            additionalProperties: false,
          },
        },
        actions: {
          'initial.complete': {
            $schema: 'https://schemas.letsflow.io/v1.0/action',
            title: 'complete',
            description: '',
            if: true,
            response: {},
            actor: ['actor'],
            update: [],
          },
        },
        states: {
          initial: {
            title: 'initial',
            description: '',
            instructions: {},
            notify: [],
            transitions: [
              {
                on: 'complete',
                by: ['*'],
                if: true,
                goto: '(done)',
                log: {
                  title: { '<ref>': 'current.action.title' },
                  description: { '<ref>': 'current.action.description' },
                  if: true,
                },
              },
            ],
          },
          '(done)': {
            title: 'done',
            description: '',
            instructions: {},
            notify: [],
          },
        },
        vars: {},
        result: {},
      });
    });
  });

  describe('actors', () => {
    it('should set the actor title', () => {
      const scenario: Scenario = {
        actors: {
          user_1: {
            properties: {
              name: { type: 'string' },
            },
          },
        },
        states: {},
      };

      expect(normalize(scenario).actors).to.deep.eq({
        user_1: {
          title: 'user 1',
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            name: { type: 'string' },
            role: {
              oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
            },
          },
          additionalProperties: false,
        },
      });
    });

    it('should convert a null actor', () => {
      const scenario: Scenario = {
        actors: {
          user: null,
        },
        states: {},
      };

      expect(normalize(scenario).actors).to.deep.eq({
        user: {
          title: 'user',
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            role: {
              oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
            },
          },
          additionalProperties: false,
        },
      });
    });

    it('should set required properties', () => {
      const scenario: Scenario = {
        actors: {
          user: {
            properties: {
              name: { type: 'string', '!required': true },
            },
          },
        },
        states: {},
      };

      expect(normalize(scenario).actors).to.deep.eq({
        user: {
          title: 'user',
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            name: { type: 'string' },
            role: {
              oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
            },
          },
          additionalProperties: false,
          required: ['name'],
        },
      });
    });

    it('should normalize properties', () => {
      const scenario: Scenario = {
        actors: {
          user: {
            properties: {
              name: 'string',
            },
            patternProperties: {
              '^foo': 'string',
            },
            additionalProperties: 'number',
          },
        },
        states: {},
      };

      expect(normalize(scenario).actors).to.deep.eq({
        user: {
          title: 'user',
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            name: { type: 'string' },
            role: {
              oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
            },
          },
          patternProperties: {
            '^foo': {
              type: 'string',
            },
          },
          additionalProperties: {
            type: 'number',
          },
        },
      });
    });
  });

  describe('actions', () => {
    it('should set all default properties', () => {
      const scenario: Scenario = {
        title: '',
        actors: {
          user: {},
          admin: {},
        },
        actions: {
          complete: {},
        },
        states: {},
      };

      expect(normalize(scenario).actions).to.deep.eq({
        complete: {
          $schema: 'https://schemas.letsflow.io/v1.0/action',
          title: 'complete',
          description: '',
          if: true,
          actor: ['*'],
          response: {},
          update: [],
        },
      });
    });

    it('should make an array of the `actor` property', () => {
      const scenario: Scenario = {
        title: '',
        actors: {},
        actions: {
          complete: {
            actor: 'user',
          },
        },
        states: {},
      };

      expect(normalize(scenario).actions).to.deep.eq({
        complete: {
          $schema: 'https://schemas.letsflow.io/v1.0/action',
          title: 'complete',
          description: '',
          if: true,
          actor: ['user'],
          response: {},
          update: [],
        },
      });
    });

    it("should should not modify the `actor` property if it's a function", () => {
      const scenario: Scenario = {
        title: '',
        actors: {},
        actions: {
          complete: {
            actor: {
              '<ref>': "users[?type=='bot']",
            },
          },
        },
        states: {},
      };

      const normalized = normalize(scenario);
      expect(normalized.actions['complete'].actor).to.deep.eq({ '<ref>': "users[?type=='bot']" });
    });

    it('should normalize the response type', () => {
      const scenario: Scenario = {
        title: '',
        actors: {},
        actions: {
          one: {
            response: 'string',
          },
          two: {
            response: {
              properties: {
                foo: {
                  type: 'string',
                  '!required': true,
                },
                bar: 'number',
              },
            },
          },
        },
        states: {},
      };

      expect(normalize(scenario).actions).to.deep.eq({
        one: {
          $schema: 'https://schemas.letsflow.io/v1.0/action',
          title: 'one',
          description: '',
          if: true,
          actor: ['*'],
          response: {
            type: 'string',
          },
          update: [],
        },
        two: {
          $schema: 'https://schemas.letsflow.io/v1.0/action',
          title: 'two',
          description: '',
          if: true,
          actor: ['*'],
          response: {
            type: 'object',
            properties: {
              foo: {
                type: 'string',
              },
              bar: {
                type: 'number',
              },
            },
            required: ['foo'],
            additionalProperties: false,
          },
          update: [],
        },
      });
    });

    it('should normalize the response schema', () => {
      const scenario: Scenario = {
        title: '',
        actors: {},
        actions: {
          complete: {
            response: 'https://example.com/schemas/response.json',
          },
        },
        states: {},
      };

      expect(normalize(scenario).actions).to.deep.eq({
        complete: {
          $schema: 'https://schemas.letsflow.io/v1.0/action',
          title: 'complete',
          description: '',
          if: true,
          actor: ['*'],
          response: {
            $ref: 'https://example.com/schemas/response.json',
          },
          update: [],
        },
      });
    });

    it("should not modify the response schema if it's a function", () => {
      const scenario: Scenario = {
        title: '',
        actors: {},
        actions: {
          complete: {
            response: {
              '<ref>': 'scenario.vars.foo',
            },
          },
        },
        states: {},
      };

      const normalized = normalize(scenario);
      expect(normalized.actions['complete'].response).to.deep.eq({ '<ref>': 'scenario.vars.foo' });
    });

    it('should normalize the update instructions', () => {
      const scenario: Scenario = {
        title: '',
        actors: {
          user: {},
          admin: {},
        },
        actions: {
          complete: {
            update: {
              set: 'vars.foo',
            },
          },
        },
        states: {},
      };

      expect(normalize(scenario).actions).to.deep.eq({
        complete: {
          $schema: 'https://schemas.letsflow.io/v1.0/action',
          title: 'complete',
          description: '',
          if: true,
          actor: ['*'],
          response: {},
          update: [
            {
              set: 'vars.foo',
              value: { '<ref>': 'current.response' },
              stub: null,
              mode: 'replace',
              if: true,
            },
          ],
        },
      });
    });
  });

  describe('states', () => {
    it('should normalize a simple state', () => {
      const scenario: Scenario = {
        states: {
          initial: {
            on: 'complete',
            by: 'actor',
            goto: '(done)',
          },
        },
      };

      const normalized = normalize(scenario);

      expect(normalized.states.initial).to.deep.eq({
        title: 'initial',
        description: '',
        instructions: {},
        notify: [],
        transitions: [
          {
            on: 'complete',
            by: ['actor'],
            if: true,
            goto: '(done)',
            log: {
              title: { '<ref>': 'current.action.title' },
              description: { '<ref>': 'current.action.description' },
              if: true,
            },
          },
        ],
      });

      expect(normalized.actions).to.deep.eq({
        'initial.complete': {
          $schema: 'https://schemas.letsflow.io/v1.0/action',
          title: 'complete',
          description: '',
          if: true,
          actor: ['actor'],
          response: {},
          update: [],
        },
      });
    });

    it('should normalize a timeout state', () => {
      const scenario: Scenario = {
        states: {
          initial: {
            after: '1m',
            goto: '(done)',
          },
        },
      };

      expect(normalize(scenario).states.initial).to.deep.eq({
        title: 'initial',
        description: '',
        instructions: {},
        notify: [],
        transitions: [
          {
            after: 60,
            if: true,
            goto: '(done)',
            log: {
              title: '',
              description: '',
              if: false,
            },
          },
        ],
      });
    });

    it('should normalize a state with multiple transitions', () => {
      const scenario: Scenario = {
        actors: {
          admin: {},
          client: {},
        },
        states: {
          initial: {
            transitions: [
              {
                on: 'complete',
                by: 'client',
                goto: '(done)',
              },
              {
                on: 'complete',
                by: 'admin',
                goto: '(ready)',
              },
              {
                on: 'cancel',
                goto: '(cancelled)',
              },
            ],
          },
        },
      };

      const normalized = normalize(scenario);

      expect(normalized.states.initial).to.deep.eq({
        title: 'initial',
        description: '',
        instructions: {},
        notify: [],
        transitions: [
          {
            on: 'complete',
            by: ['client'],
            if: true,
            goto: '(done)',
            log: {
              title: { '<ref>': 'current.action.title' },
              description: { '<ref>': 'current.action.description' },
              if: true,
            },
          },
          {
            on: 'complete',
            by: ['admin'],
            if: true,
            goto: '(ready)',
            log: {
              title: { '<ref>': 'current.action.title' },
              description: { '<ref>': 'current.action.description' },
              if: true,
            },
          },
          {
            on: 'cancel',
            by: ['*'],
            if: true,
            goto: '(cancelled)',
            log: {
              title: { '<ref>': 'current.action.title' },
              description: { '<ref>': 'current.action.description' },
              if: true,
            },
          },
        ],
      });

      expect(normalized.actions).to.deep.eq({
        'initial.complete': {
          $schema: 'https://schemas.letsflow.io/v1.0/action',
          title: 'complete',
          description: '',
          if: true,
          actor: ['client', 'admin'],
          response: {},
          update: [],
        },
        'initial.cancel': {
          $schema: 'https://schemas.letsflow.io/v1.0/action',
          title: 'cancel',
          description: '',
          if: true,
          actor: ['admin', 'client'],
          response: {},
          update: [],
        },
      });
    });

    it('should set an implicit notify', () => {
      const scenario: Scenario = {
        states: {
          initial: {
            on: 'complete',
            by: 'service:foo',
            goto: '(done)',
          },
          second: {
            transitions: [
              {
                on: 'complete',
                by: 'service:foo',
                goto: '(done)',
              },
              {
                on: 'cancel',
                by: 'service:foo',
                goto: '(cancelled)',
              },
            ],
          },
        },
      };

      const normalized = normalize(scenario);

      expect(normalized.states.initial.notify).to.deep.eq([
        {
          service: 'foo',
          after: 0,
          if: true,
          trigger: 'complete',
        },
      ]);

      expect(normalized.states.second.notify).to.deep.eq([
        {
          service: 'foo',
          after: 0,
          if: true,
          trigger: null,
        },
      ]);
    });

    it('should normalize notify', () => {
      const scenario: Scenario = {
        states: {
          initial: {
            on: 'complete',
            by: 'service:foo',
            goto: '(done)',
            notify: 'foo',
          },
          second: {
            on: 'complete',
            by: 'service:foo',
            goto: '(done)',
            notify: ['foo', 'bar'],
          },
          third: {
            on: 'complete',
            by: 'service:foo',
            goto: '(complete)',
            notify: {
              service: 'foo',
              if: { '<ref>': 'vars.foo' },
              after: '5days',
              trigger: 'complete',
            },
          },
        },
      };

      const normalized = normalize(scenario);

      expect(normalized.states.initial.notify).to.deep.eq([
        { service: 'foo', after: 0, if: true, trigger: 'complete' },
      ]);
      expect(normalized.states.second.notify).to.deep.eq([
        { service: 'foo', after: 0, if: true, trigger: 'complete' },
        { service: 'bar', after: 0, if: true, trigger: null },
      ]);
      expect(normalized.states.third.notify).to.deep.eq([
        {
          service: 'foo',
          if: { '<ref>': 'vars.foo' },
          after: 432000,
          trigger: 'complete',
        },
      ]);

      expect(normalized.actions['third.complete']).to.deep.eq({
        $schema: 'https://schemas.letsflow.io/v1.0/action',
        title: 'complete',
        description: '',
        if: true,
        actor: ['service:foo'],
        response: {},
        update: [],
      });
    });

    it('should set trigger when normalizing notify', () => {
      const scenario: Scenario = {
        states: {
          initial: {
            on: 'complete',
            by: 'service:foo',
            goto: '(done)',
            notify: {
              service: 'service:foo',
              after: 10,
            },
          },
          second: {
            transitions: [
              {
                on: 'complete',
                by: 'service:foo',
                goto: '(done)',
              },
              {
                on: 'cancel',
                by: 'service:foo',
                goto: '(cancelled)',
              },
            ],
            notify: {
              service: 'service:foo',
              after: 10,
            },
          },
        },
      };

      const normalized = normalize(scenario);

      expect(normalized.states.initial.notify).to.deep.eq([
        {
          service: 'foo',
          after: 10,
          if: true,
          trigger: 'complete',
        },
      ]);

      expect(normalized.states.second.notify).to.deep.eq([
        {
          service: 'foo',
          after: 10,
          if: true,
          trigger: null,
        },
      ]);
    });

    it('should not set trigger when normalizing notify and service has no action', () => {
      const scenario = normalize({
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
            notify: 'service:foo',
          },
        },
      });

      expect(scenario.states.initial.notify).to.deep.eq([{ service: 'foo', after: 0, if: true, trigger: null }]);
    });

    it('should normalize state transition log', () => {
      const scenario: Scenario = {
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
            log: false,
          },
          second: {
            on: 'complete',
            goto: '(done)',
            log: {
              title: 'foo',
              description: 'bar',
            },
          },
          third: {
            on: 'complete',
            goto: '(done)',
          },
          fourth: {
            on: 'complete',
            goto: '(done)',
            log: {
              title: 'foo',
              description: 'bar',
              if: { '<ref>': 'vars.foo' },
              extra: 'baz',
            },
          },
        },
      };

      const normalized = normalize(scenario);

      expect(normalized.states.initial.transitions[0].log).to.deep.eq({
        title: '',
        description: '',
        if: false,
      });

      expect(normalized.states.second.transitions[0].log).to.deep.eq({
        title: 'foo',
        description: 'bar',
        if: true,
      });

      expect(normalized.states.third.transitions[0].log).to.deep.eq({
        title: { '<ref>': 'current.action.title' },
        description: { '<ref>': 'current.action.description' },
        if: true,
      });

      expect(normalized.states.fourth.transitions[0].log).to.deep.eq({
        title: 'foo',
        description: 'bar',
        if: { '<ref>': 'vars.foo' },
        extra: 'baz',
      });
    });
  });

  describe('vars and result', () => {
    it('should normalize a vars object', () => {
      const scenario: Scenario = {
        states: {},
        vars: {
          foo: 'string',
          emails: {
            type: 'array',
            title: 'email addresses',
            items: 'string',
          },
          test: {
            properties: {
              one: 'string',
              two: {
                type: 'number',
                '!required': true,
              } as any,
            },
          },
        },
      };

      expect(normalize(scenario).vars).to.deep.eq({
        foo: {
          title: 'foo',
          type: 'string',
        },
        emails: {
          type: 'array',
          title: 'email addresses',
          items: {
            type: 'string',
          },
        },
        test: {
          title: 'test',
          type: 'object',
          properties: {
            one: {
              type: 'string',
            },
            two: {
              type: 'number',
            },
          },
          required: ['two'],
          additionalProperties: false,
        },
      });
    });

    it('should normalize a result schema', () => {
      const scenario: Scenario = {
        states: {},
        result: 'string',
      };

      expect(normalize(scenario).result).to.deep.eq({
        type: 'string',
      });
    });
  });

  describe('schema', () => {
    it('should normalize an object schema', () => {
      const schema: Schema = {
        properties: {
          one: 'string',
          two: {
            type: 'number',
            '!required': true,
          } as any,
        },
      };

      expect(normalize(schema, { $schema: schemaSchema.$id })).to.deep.eq({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          one: {
            type: 'string',
          },
          two: {
            type: 'number',
          },
        },
        required: ['two'],
        additionalProperties: false,
      });
    });

    it('should normalize an array schema', () => {
      const schema: Schema = {
        title: 'email addresses',
        items: 'string',
      };

      expect(normalize(schema, { $schema: schemaSchema.$id })).to.deep.eq({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'array',
        title: 'email addresses',
        items: {
          type: 'string',
        },
      });
    });

    it('should normalize a strings into schemas', () => {
      const schema: Schema = {
        properties: {
          one: 'string',
          two: '#/definitions/two',
          three: 'https://example.com/schemas/three.json',
        },
      };

      expect(normalize(schema, { $schema: schemaSchema.$id })).to.deep.eq({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        properties: {
          one: {
            type: 'string',
          },
          two: {
            $ref: '#/definitions/two',
          },
          three: {
            $ref: 'https://example.com/schemas/three.json',
          },
        },
        additionalProperties: false,
      });
    });

    it('should normalize definitions', () => {
      const schema: Schema = {
        $defs: {
          one: 'string',
        },
        definitions: {
          two: 'number',
        },
      };

      expect(normalize(schema, { $schema: schemaSchema.$id })).to.deep.eq({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        $defs: {
          one: {
            type: 'string',
          },
        },
        definitions: {
          two: {
            type: 'number',
          },
        },
      });
    });

    it('should normalize pattern properties', () => {
      const schema: Schema = {
        patternProperties: {
          '^foo': 'string',
        },
      };

      expect(normalize(schema, { $schema: schemaSchema.$id })).to.deep.eq({
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        type: 'object',
        patternProperties: {
          '^foo': {
            type: 'string',
          },
        },
        additionalProperties: false,
      });
    });
  });
});
