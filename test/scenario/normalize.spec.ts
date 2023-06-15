import { Scenario, normalize } from '../../src/scenario';
import { expect } from 'chai';

describe('normalize scenario', () => {
  describe('scenario', () => {
    it('should normalize a minimal scenario', () => {
      const scenario: Scenario = {
        title: 'minimal scenario',
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
        $schema: 'https://specs.letsflow.io/v1.0.0/scenario',
        title: 'minimal scenario',
        description: '',
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
            $schema: 'https://specs.letsflow.io/v1.0.0/action',
            title: 'complete',
            description: '',
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
            transitions: [
              {
                on: 'complete',
                if: true,
                goto: '(done)',
              },
            ],
          },
        },
        vars: {},
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
        $schema: 'https://specs.letsflow.io/v1.0.0/scenario',
        title: '',
        description: '',
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
        $schema: 'https://specs.letsflow.io/v1.0.0/scenario',
        title: '',
        description: '',
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
        $schema: 'https://specs.letsflow.io/v1.0.0/scenario',
        title: '',
        description: '',
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
            $schema: 'https://specs.letsflow.io/v1.0.0/action',
            title: 'complete',
            description: '',
            actor: ['user', 'admin'],
            update: [],
          },
        },
        states: {},
        vars: {},
      });
    });

    it('should make an array of the `actor` property', () => {
      const scenario: Scenario = {
        title: '',
        actors: {
          user: {},
          admin: {},
        },
        actions: {
          complete: {
            actor: 'user',
          },
        },
        states: {},
      };

      expect(normalize(scenario)).to.deep.eq({
        $schema: 'https://specs.letsflow.io/v1.0.0/scenario',
        title: '',
        description: '',
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
            $schema: 'https://specs.letsflow.io/v1.0.0/action',
            title: 'complete',
            description: '',
            actor: ['user'],
            update: [],
          },
        },
        states: {},
        vars: {},
      });
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
              path: 'vars.foo',
            },
          },
        },
        states: {},
      };

      expect(normalize(scenario)).to.deep.eq({
        $schema: 'https://specs.letsflow.io/v1.0.0/scenario',
        title: '',
        description: '',
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
            $schema: 'https://specs.letsflow.io/v1.0.0/action',
            title: 'complete',
            description: '',
            actor: ['user', 'admin'],
            update: [
              {
                path: 'vars.foo',
                data: { '<ref>': 'response' },
                merge: false,
                if: true,
              },
            ],
          },
        },
        states: {},
        vars: {},
      });
    });
  });
});
