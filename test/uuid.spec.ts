import { expect } from 'chai';
import { uuid } from '../src/uuid';

describe('uuid', () => {
  it('should create a deterministic uuid', function () {
    const scenario = {
      $schema: 'https://specs.letsflow.io/v1.0/scenario',
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
          $schema: 'https://specs.letsflow.io/v1.0/action',
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

    expect(uuid(scenario)).to.eq('b4130302-8e5b-5dbe-8ecb-dfc4dad164ac');
  });
});
