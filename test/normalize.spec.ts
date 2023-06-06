import { normalize, Scenario } from '../src';
import { expect } from 'chai';

describe('normalize', () => {
  describe('normalize scenario', () => {
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
            properties: {
              title: { type: 'string' },
            }
          }
        },
        actions: {
          complete: {
            $schema: "https://specs.letsflow.io/v1.0.0/action",
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
              }
            ],
          }
        },
        assets: {},
      });
    });
  });

  describe('normalize actors', () => {
    it('should set the actor title', () => {
      const scenario: Scenario = {
        title: '',
        actors: {
          user_1: {
            properties: {
              name: { type: 'string' }
            }
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
            properties: {
              title: { type: 'string' },
              name: { type: 'string' }
            }
          }
        },
        actions: {},
        states: {},
        assets: {},
      });
    });
  });
});
