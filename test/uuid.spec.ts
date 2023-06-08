import { uuid } from '../src/';
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
      assets: {},
    };

    expect(uuid(scenario)).to.eq('9b590526-b650-5700-9e96-c6785343a4b0');
  });
});
