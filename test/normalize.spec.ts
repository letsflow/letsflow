import { normalize, Scenario } from '../src';
import { expect } from 'chai';

describe('normalize', () => {
  describe('normalize scenario', () => {
    it('should normalize a minimal scenario', () => {
      const scenario: Scenario = {
        title: 'minimal scenario',
        actors: {
          user: {},
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
      };

      expect(normalize(scenario)).to.deep.eq({
        title: 'minimal scenario',
        description: '',
        actors: {
          user: {
            title: 'user',
            properties: {
              title: { type: 'string' },
            }
          }
        },
        actions: {
          complete: {
            $schema: "https://specs.letsflow.io/v0.3.0/action",
            title: 'complete',
            description: '',
            actor: ['user'],
            responses: {
              ok: { title: 'ok', update: [] },
            },
          },
        },
        states: {
          initial: {
            title: 'initial',
            instructions: {},
            actions: ['complete'],
            transitions: [
              {
                on: { action: 'complete', response: undefined },
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
        title: 'minimal scenario',
        actors: {
          user: {
            properties: {
              name: { type: 'string' }
            }
          },
        },
        actions: {},
        states: {},
      };

      expect(normalize(scenario)).to.deep.eq({
        title: 'minimal scenario',
        description: '',
        actors: {
          user: {
            title: 'user',
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
