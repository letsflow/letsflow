import {normalize} from "../src/normalize";
import {expect} from "chai";

describe('normalize', () => {
  describe('normalize scenario', () => {
    it('should normalize a minimal scenario', () => {
      const input = {
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

      const output = normalize(input);

      expect(output).to.deep.eq({
        title: 'minimal scenario',
        description: undefined,
        actors: [
          {
            schema: 'https://specs.letsflow.io/v0.3.0/actor#',
            key: 'user',
            title: 'user',
          },
        ],
        actions: [
          {
            schema: 'https://specs.letsflow.io/v0.3.0/action#',
            key: 'complete',
            title: 'complete',
            description: undefined,
            actors: [ 'user' ],
            responses: [
              { key: 'ok', title: 'ok', update: [] },
            ],
          },
        ],
        states: [
          {
            key: 'initial',
            title: 'initial',
            description: undefined,
            actions: [ 'complete' ],
            transitions: [
              {
                action: 'complete',
                response: undefined,
                condition: true,
                target: '(done)',
              }
            ],
          }
        ],
        data: {},
      });
    });
  });
});
