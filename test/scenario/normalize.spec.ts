import { expect } from 'chai';
import { normalize, Scenario } from '../../src/scenario';

describe('normalize scenario', () => {
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
        $schema: 'https://schemas.letsflow.io/v1.0.0/scenario',
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
            },
          },
        },
        actions: {
          'initial.complete': {
            $schema: 'https://schemas.letsflow.io/v1.0.0/action',
            title: 'complete',
            description: '',
            if: true,
            responseSchema: {},
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
        title: '',
        actors: {
          user_1: {
            properties: {
              name: { type: 'string' },
            },
          },
        },
        actions: {},
        states: {},
      };

      expect(normalize(scenario)).to.deep.eq({
        $schema: 'https://schemas.letsflow.io/v1.0.0/scenario',
        title: '',
        description: '',
        tags: [],
        actors: {
          user_1: {
            title: 'user 1',
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              name: { type: 'string' },
            },
          },
        },
        actions: {},
        states: {},
        vars: {},
        result: {},
      });
    });

    it('should convert a null actor', () => {
      const scenario: Scenario = {
        title: '',
        actors: {
          user: null,
        },
        actions: {},
        states: {},
      };

      expect(normalize(scenario)).to.deep.eq({
        $schema: 'https://schemas.letsflow.io/v1.0.0/scenario',
        title: '',
        description: '',
        tags: [],
        actors: {
          user: {
            title: 'user',
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
            },
          },
        },
        actions: {},
        states: {},
        vars: {},
        result: {},
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

      expect(normalize(scenario)).to.deep.eq({
        $schema: 'https://schemas.letsflow.io/v1.0.0/scenario',
        title: '',
        description: '',
        tags: [],
        actors: {
          user: {
            title: 'user',
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
            },
          },
          admin: {
            title: 'admin',
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
            },
          },
        },
        actions: {
          complete: {
            $schema: 'https://schemas.letsflow.io/v1.0.0/action',
            title: 'complete',
            description: '',
            if: true,
            actor: ['user', 'admin'],
            responseSchema: {},
            update: [],
          },
        },
        states: {},
        vars: {},
        result: {},
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

      expect(normalize(scenario)).to.deep.eq({
        $schema: 'https://schemas.letsflow.io/v1.0.0/scenario',
        title: '',
        description: '',
        tags: [],
        actors: {},
        actions: {
          complete: {
            $schema: 'https://schemas.letsflow.io/v1.0.0/action',
            title: 'complete',
            description: '',
            if: true,
            actor: ['user'],
            responseSchema: {},
            update: [],
          },
        },
        states: {},
        vars: {},
        result: {},
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

    it('should normalize the response schema', () => {
      const scenario: Scenario = {
        title: '',
        actors: {},
        actions: {
          complete: {
            responseSchema: 'https://example.com/schemas/response.json',
          },
        },
        states: {},
      };

      expect(normalize(scenario)).to.deep.eq({
        $schema: 'https://schemas.letsflow.io/v1.0.0/scenario',
        title: '',
        description: '',
        tags: [],
        actors: {},
        actions: {
          complete: {
            $schema: 'https://schemas.letsflow.io/v1.0.0/action',
            title: 'complete',
            description: '',
            if: true,
            actor: [],
            responseSchema: {
              $ref: 'https://example.com/schemas/response.json',
            },
            update: [],
          },
        },
        states: {},
        vars: {},
        result: {},
      });
    });

    it("should not modify the response schema if it's a function", () => {
      const scenario: Scenario = {
        title: '',
        actors: {},
        actions: {
          complete: {
            responseSchema: {
              '<ref>': 'scenario.vars.foo',
            },
          },
        },
        states: {},
      };

      const normalized = normalize(scenario);
      expect(normalized.actions['complete'].responseSchema).to.deep.eq({ '<ref>': 'scenario.vars.foo' });
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

      expect(normalize(scenario)).to.deep.eq({
        $schema: 'https://schemas.letsflow.io/v1.0.0/scenario',
        title: '',
        description: '',
        tags: [],
        actors: {
          user: {
            title: 'user',
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
            },
          },
          admin: {
            title: 'admin',
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
            },
          },
        },
        actions: {
          complete: {
            $schema: 'https://schemas.letsflow.io/v1.0.0/action',
            title: 'complete',
            description: '',
            if: true,
            actor: ['user', 'admin'],
            responseSchema: {},
            update: [
              {
                set: 'vars.foo',
                data: { '<ref>': 'current.response' },
                merge: false,
                if: true,
              },
            ],
          },
        },
        states: {},
        vars: {},
        result: {},
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
          },
        ],
      });

      expect(normalized.actions).to.deep.eq({
        'initial.complete': {
          $schema: 'https://schemas.letsflow.io/v1.0.0/action',
          title: 'complete',
          description: '',
          if: true,
          actor: ['actor'],
          responseSchema: {},
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
          },
          {
            on: 'complete',
            by: ['admin'],
            if: true,
            goto: '(ready)',
          },
          {
            on: 'cancel',
            by: ['*'],
            if: true,
            goto: '(cancelled)',
          },
        ],
      });

      expect(normalized.actions).to.deep.eq({
        'initial.complete': {
          $schema: 'https://schemas.letsflow.io/v1.0.0/action',
          title: 'complete',
          description: '',
          if: true,
          actor: ['client', 'admin'],
          responseSchema: {},
          update: [],
        },
        'initial.cancel': {
          $schema: 'https://schemas.letsflow.io/v1.0.0/action',
          title: 'cancel',
          description: '',
          if: true,
          actor: ['admin', 'client'],
          responseSchema: {},
          update: [],
        },
      });
    });

    it('should normalize notify', () => {
      const scenario: Scenario = {
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
            notify: 'foo',
          },
          second: {
            on: 'complete',
            goto: '(done)',
            notify: ['foo', 'bar'],
          },
          third: {
            on: 'complete',
            goto: '(done)',
            notify: {
              service: 'foo',
              if: { '<ref>': 'vars.foo' },
              after: '5days',
              trigger: 'complete',
            },
          },
        },
      };

      expect(normalize(scenario).states.initial.notify).to.deep.eq([{ service: 'foo', after: 0, if: true }]);
      expect(normalize(scenario).states.second.notify).to.deep.eq([
        { service: 'foo', after: 0, if: true },
        { service: 'bar', after: 0, if: true },
      ]);
      expect(normalize(scenario).states.third.notify).to.deep.eq([
        {
          service: 'foo',
          if: { '<ref>': 'vars.foo' },
          after: 432000,
          trigger: 'complete',
        },
      ]);
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
});
