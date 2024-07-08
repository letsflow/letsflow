import { Scenario, validate } from '../../src/scenario';
import { expect } from 'chai';

describe('validate scenario', () => {
  describe('scenario', () => {
    it('should succeed with a minimal scenario', () => {
      const scenario = {
        title: 'minimal scenario',
        actions: {
          next: {},
        },
        states: {
          initial: {
            on: 'next',
            goto: '(done)',
          },
        },
      };

      const result = validate(scenario);

      expect(validate.errors).to.eq(null);
      expect(result).to.be.true;
    });

    it('show fail if title is missing', () => {
      const scenario = {
        actions: {
          next: {},
        },
        states: {
          initial: {
            on: 'next',
            goto: '(done)',
          },
        },
      };

      const result = validate(scenario);

      expect(result).to.be.false;
      expect(validate.errors).to.deep.contain({
        instancePath: '',
        keyword: 'required',
        message: "must have required property 'title'",
        params: {
          missingProperty: 'title',
        },
        schemaPath: '#/required',
      });
    });
  });

  describe('actors', () => {
    it('should succeed with a basic actor', () => {
      const scenario = {
        title: '',
        actors: {
          user: {},
        },
        actions: {
          next: {},
        },
        states: {
          initial: { on: 'next', goto: '(done)' },
        },
      };

      const result = validate(scenario);

      expect(validate.errors).to.eq(null);
      expect(result).to.be.true;
    });

    it('should succeed with a null actor', () => {
      const scenario = {
        title: '',
        actors: {
          user: null,
        },
        actions: {
          next: {},
        },
        states: {
          initial: { on: 'next', goto: '(done)' },
        },
      } as unknown as Scenario;

      const result = validate(scenario);

      expect(validate.errors).to.eq(null);
      expect(result).to.be.true;
    });

    it('should succeed with an actor with schema properties', () => {
      const scenario = {
        title: '',
        actors: {
          user: {
            properties: {
              name: {
                type: 'string',
              },
              favorites: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            },
          },
        },
        actions: {
          next: {},
        },
        states: {
          initial: { on: 'next', goto: '(done)' },
        },
      };

      const result = validate(scenario);

      expect(validate.errors).to.eq(null);
      expect(result).to.be.true;
    });

    it('should succeed with an actor with simple properties', () => {
      const scenario = {
        title: '',
        actors: {
          user: {
            properties: {
              name: 'string',
              age: 'integer',
              verified: 'boolean',
              score: 'number',
            },
          },
        },
        actions: {
          next: {},
        },
        states: {
          initial: { on: 'next', goto: '(done)' },
        },
      };

      const result = validate(scenario);

      expect(validate.errors).to.eq(null);
      expect(result).to.be.true;
    });

    it('should fail for an actor of an incorrect type', () => {
      const scenario = {
        title: '',
        actors: {
          user: { type: 'string' },
        },
        actions: {
          next: {},
        },
        states: {
          initial: { on: 'next', goto: '(done)' },
        },
      };

      const result = validate(scenario);

      expect(result).to.be.false;
      expect(validate.errors).to.be.deep.contain({
        instancePath: '/actors/user/type',
        keyword: 'const',
        message: 'must be equal to constant',
        params: { allowedValue: 'object' },
        schemaPath: '#/oneOf/0/allOf/1/properties/type/const',
      });
    });

    it('should succeed with a ref to a schema', () => {
      const scenario = {
        title: '',
        actors: {
          user: {
            title: 'User',
            $ref: 'https://example.com/schemas/person',
          },
        },
        actions: {
          next: {},
        },
        states: {
          initial: { on: 'next', goto: '(done)' },
        },
      };

      const result = validate(scenario);

      expect(validate.errors).to.eq(null);
      expect(result).to.be.true;
    });
  });

  describe('actions', () => {
    it('should succeed with a standard action', () => {
      const scenario = {
        title: '',
        actors: {
          user: {},
        },
        actions: {
          next: {
            title: 'Complete',
            description: 'Complete the process',
            actor: 'user',
            responses: {
              one: { title: 'one' },
              two: { title: 'two', update: [{ set: 'vars.reason' }] },
              three: {
                title: 'two',
                update: {
                  set: 'vars.reason',
                  data: { '<eval>': 'response | { message, code }' },
                  patch: true,
                  if: { '<eval>': "response.types.state | contains(@, 'WA')" },
                },
              },
            },
          },
        },
        states: {
          initial: { on: 'next', goto: '(done)' },
        },
      };

      const result = validate(scenario);

      expect(validate.errors).to.eq(null);
      expect(result).to.be.true;
    });

    it('should fail if update instruction is missing set', () => {
      const scenario = {
        title: '',
        actions: {
          next: {
            update: {
              data: 'foo',
            },
          },
        },
        states: {
          initial: { on: 'next', goto: '(done)' },
        },
      };

      const result = validate(scenario);

      expect(result).to.be.false;
      expect(validate.errors).to.deep.contain({
        instancePath: '/actions/next/update',
        keyword: 'required',
        message: "must have required property 'set'",
        params: {
          missingProperty: 'set',
        },
        schemaPath: '#/required',
      });
    });

    it('should fail if action is referencing a non-existing actor', () => {
      const scenario = {
        title: '',
        actors: {
          user: {},
        },
        actions: {
          next: {
            actor: 'admin',
          },
        },
        states: {
          initial: { on: 'next', goto: '(done)' },
        },
      };

      const result = validate(scenario);

      expect(result).to.be.false;
      expect(validate.errors).to.deep.contain({
        instancePath: '/actions/next/actor',
        keyword: '',
        message: 'must reference an actor',
        params: {
          allowedValues: ['user'],
          value: 'admin',
        },
        schemaPath: '',
      });
    });

    it('should fail if update instruction is missing set', () => {
      const scenario = {
        title: '',
        actions: {
          next: {
            update: {
              data: 'foo',
            },
          },
        },
        states: {
          initial: { on: 'next', goto: '(done)' },
        },
      };

      const result = validate(scenario);

      expect(result).to.be.false;
      expect(validate.errors).to.deep.contain({
        instancePath: '/actions/next/update',
        keyword: 'required',
        message: "must have required property 'set'",
        params: {
          missingProperty: 'set',
        },
        schemaPath: '#/required',
      });
    });
  });

  describe('states', () => {
    describe('simple state', () => {
      it('should succeed with a simple state', () => {
        const scenario = {
          title: '',
          actions: {
            next: {},
          },
          states: {
            initial: {
              title: 'Initial',
              description: 'The initial state',
              on: 'next',
              goto: '(done)',
            },
          },
        };

        const result = validate(scenario);

        expect(validate.errors).to.eq(null);
        expect(result).to.be.true;
      });

      it('should succeed with a timeout state', () => {
        const scenario = {
          title: '',
          actions: {},
          states: {
            initial: {
              title: 'Initial',
              description: 'The initial state',
              after: '15 minutes',
              goto: '(done)',
            },
          },
        };

        const result = validate(scenario);

        expect(validate.errors).to.eq(null);
        expect(result).to.be.true;
      });

      it('should succeed with a state with instructions', () => {
        const scenario = {
          title: '',
          actors: {
            user: {},
          },
          actions: {
            next: {},
          },
          states: {
            initial: {
              title: 'Initial',
              description: 'The initial state',
              instructions: {
                user: 'Press next to continue',
              },
              on: 'next',
              goto: 'second',
            },
            second: {
              title: 'Second',
              description: 'The second state',
              instructions: {
                user: 'Wait for 5 minutes',
              },
              after: '5 minutes',
              goto: '(done)',
            },
          },
        };

        const result = validate(scenario);

        expect(validate.errors).to.eq(null);
        expect(result).to.be.true;
      });

      it('should fail for a simple state with a condition', () => {
        const scenario = {
          title: '',
          actions: {
            next: {},
          },
          states: {
            initial: {
              on: 'next',
              goto: '(done)',
              if: true,
            },
          },
        };

        const result = validate(scenario);

        expect(result).to.be.false;
        expect(validate.errors).to.deep.contain({
          instancePath: '/states/initial/if',
          keyword: 'type',
          message: 'must be null',
          params: {
            type: 'null',
          },
          schemaPath: '#/properties/if/type',
        });
      });

      it('should fail for a timeout state with a condition', () => {
        const scenario = {
          title: '',
          actions: {
            next: {},
          },
          states: {
            initial: {
              after: '5 minutes',
              goto: '(done)',
              if: true,
            },
          },
        };

        const result = validate(scenario);

        expect(result).to.be.false;
        expect(validate.errors).to.deep.contain({
          instancePath: '/states/initial/if',
          keyword: 'type',
          message: 'must be null',
          params: {
            type: 'null',
          },
          schemaPath: '#/properties/if/type',
        });
      });

      it('should fail if `on` references an unknown action', () => {
        const scenario = {
          title: '',
          actions: {},
          states: {
            initial: {
              on: 'foo',
              goto: '(done)',
            },
          },
        };

        const result = validate(scenario);

        expect(result).to.be.false;
        expect(validate.errors).to.deep.contain({
          instancePath: '/states/initial/on',
          keyword: '',
          message: 'must reference an action',
          params: {
            value: 'foo',
            allowedValues: [],
          },
          schemaPath: '',
        });
      });

      it('should fail if `goto` references an unknown state', () => {
        const scenario = {
          title: '',
          actions: {
            next: {},
          },
          states: {
            initial: {
              on: 'next',
              goto: 'foo',
            },
            second: {
              after: '5 minutes',
              goto: 'bar',
            },
          },
        };

        const result = validate(scenario);

        expect(result).to.be.false;
        expect(validate.errors).to.deep.contain({
          instancePath: '/states/initial/goto',
          keyword: '',
          message: 'must reference a state',
          params: {
            value: 'foo',
            allowedValues: ['initial', 'second'],
          },
          schemaPath: '',
        });
        expect(validate.errors).to.deep.contain({
          instancePath: '/states/second/goto',
          keyword: '',
          message: 'must reference a state',
          params: {
            value: 'bar',
            allowedValues: ['initial', 'second'],
          },
          schemaPath: '',
        });
      });
    });

    describe('explicit state', () => {
      it('should succeed with an explicit state', () => {
        const scenario = {
          title: '',
          actions: {
            next: {},
          },
          states: {
            initial: {
              title: 'Initial',
              description: 'The initial state',
              transitions: [
                {
                  after: '15 minutes',
                  goto: '(failed)',
                },
                {
                  on: 'next',
                  goto: '(done)',
                },
              ],
            },
          },
        };

        const result = validate(scenario);

        expect(validate.errors).to.eq(null);
        expect(result).to.be.true;
      });

      it('should succeed with an explicit state with actions', () => {
        const scenario = {
          title: '',
          actions: {
            next: {},
            other: {},
          },
          states: {
            initial: {
              title: 'Initial',
              description: 'The initial state',
              actions: ['next', 'other'],
              transitions: [
                {
                  on: 'next',
                  goto: '(done)',
                },
              ],
            },
          },
        };

        const result = validate(scenario);

        expect(validate.errors).to.eq(null);
        expect(result).to.be.true;
      });

      it('should succeed with a state with instructions', () => {
        const scenario = {
          title: '',
          actors: {
            user: {},
          },
          actions: {
            next: {},
          },
          states: {
            initial: {
              title: 'Initial',
              description: 'The initial state',
              instructions: {
                user: 'Press next to finish',
              },
              transitions: [
                {
                  after: '15 minutes',
                  goto: '(failed)',
                },
                {
                  on: 'next',
                  goto: '(done)',
                },
              ],
            },
          },
        };

        const result = validate(scenario);

        expect(validate.errors).to.eq(null);
        expect(result).to.be.true;
      });

      it('should succeed for transitions with a condition', () => {
        const scenario = {
          title: '',
          actions: {
            next: {},
          },
          states: {
            initial: {
              transitions: [
                {
                  on: 'next',
                  goto: '(done)',
                  if: true,
                },
              ],
            },
          },
        };

        const result = validate(scenario);

        expect(validate.errors).to.eq(null);
        expect(result).to.be.true;
      });

      it('should fail if state references an unknown action', () => {
        const scenario = {
          title: '',
          actions: {
            next: {},
          },
          states: {
            initial: {
              actions: ['foo', 'next'],
              transitions: [
                {
                  on: 'next',
                  goto: '(done)',
                },
              ],
            },
          },
        };

        const result = validate(scenario);

        expect(result).to.be.false;
        expect(validate.errors).to.deep.contain({
          instancePath: '/states/initial/actions/0',
          keyword: '',
          message: 'must reference an action',
          params: {
            allowedValues: ['next'],
            value: 'foo',
          },
          schemaPath: '',
        });
      });

      it('should fail if `on` references an unknown action', () => {
        const scenario = {
          title: '',
          actions: {},
          states: {
            initial: {
              transitions: [
                {
                  on: 'foo',
                  goto: '(done)',
                },
              ],
            },
          },
        };

        const result = validate(scenario);

        expect(result).to.be.false;
        expect(validate.errors).to.deep.contain({
          instancePath: '/states/initial/transitions/0/on',
          keyword: '',
          message: 'must reference an action',
          params: {
            allowedValues: [],
            value: 'foo',
          },
          schemaPath: '',
        });
      });

      it('should fail if `goto` references an unknown state', () => {
        const scenario = {
          title: '',
          actions: {
            next: {},
          },
          states: {
            initial: {
              transitions: [
                {
                  on: 'next',
                  goto: 'foo',
                },
              ],
            },
          },
        };

        const result = validate(scenario);

        expect(result).to.be.false;
        expect(validate.errors).to.deep.contain({
          instancePath: '/states/initial/transitions/0/goto',
          keyword: '',
          message: 'must reference a state',
          params: {
            allowedValues: ['initial'],
            value: 'foo',
          },
          schemaPath: '',
        });
      });
    });

    describe('end state', () => {
      it('should succeed with an end state', () => {
        const scenario = {
          title: '',
          actions: {
            next: {},
          },
          states: {
            initial: {
              on: 'next',
              goto: '(done)',
            },
            '(done)': {
              title: 'Done',
              description: 'The end state',
            },
          },
        };

        const result = validate(scenario);

        expect(validate.errors).to.eq(null);
        expect(result).to.be.true;
      });
    });
  });
});
