import { uuid } from '../src/uuid';
import { expect } from 'chai';

describe('uuid', () => {
  it('should create a deterministic uuid', function () {
    const scenario = {
      $schema: 'https://specs.letsflow.io/v1.0.0/scenario',
      title: 'minimal scenario',
      description: '',
      actors: {
        actor: {
          title: 'actor',
          properties: {
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
    };

    expect(uuid(scenario)).to.eq('906a51d4-bfb5-5db4-98d1-4d660298c77f');
  });
});
