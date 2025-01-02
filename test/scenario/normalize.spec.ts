import { expect } from 'chai';
import { normalize, Scenario } from '../../src/scenario';

describe('normalize scenario', () => {
  describe('scenario', () => {
    it('should normalize a minimal scenario', () => {
      const scenario: Scenario = {
        title: 'minimal scenario',
        tags: ['foo', 'bar'],
        actions: {
          complete: {},
        },
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
          complete: {
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
            actions: ['complete'],
            notify: [],
            transitions: [
              {
                on: 'complete',
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
});
