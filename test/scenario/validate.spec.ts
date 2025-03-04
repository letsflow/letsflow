import { expect } from 'chai';
import { Scenario, validate } from '../../src/scenario';

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
  });

  describe('actors', () => {
    it('should succeed with a basic actor', () => {
      const scenario = {
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

    it('should succeed with an actor with role', () => {
      const scenario = {
        actors: {
          user: { role: ['user', 'client'] },
          admin: { role: 'admin' },
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

    it('should succeed with an actor with schema properties', () => {
      const scenario = {
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
      expect(validate.errors![0]).to.be.deep.eq({
        instancePath: '/actors/user/type',
        keyword: 'const',
        message: 'must be equal to constant',
        params: {
          allowedValue: 'object',
        },
        schemaPath: '#/properties/type/const',
      });
    });

    it('should succeed with a ref to a schema', () => {
      const scenario = {
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

    it('should fail if update instruction is missing "set" property', () => {
      const scenario = {
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
        message: 'must reference an actor or service',
        params: {
          allowedValues: ['user'],
          value: 'admin',
        },
        schemaPath: '',
      });
    });

    it('should succeed if action is referencing a service', () => {
      const scenario = {
        actions: {
          next: {
            actor: 'service:email',
          },
        },
        states: {
          initial: { on: 'next', goto: '(done)', notify: 'email' },
        },
      };

      const result = validate(scenario);

      expect(validate.errors).to.eq(null);
      expect(result).to.be.true;
    });

    it('should success if action is referencing a wildcard actor', () => {
      const scenario = {
        actors: {
          'client_*': {},
        },
        actions: {
          next: {
            actor: 'client_*',
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

      it('should fail if `goto` references an unknown state', () => {
        const scenario = {
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

      it('should fail if `goto` references an unknown state', () => {
        const scenario = {
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

      it('should fail if explicit state has by property', () => {
        const scenario = {
          states: {
            initial: {
              by: 'someone',
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
        expect(validate.errors![0]).to.deep.eq({
          instancePath: '/states/initial',
          keyword: 'errorMessage',
          message: 'must not have a property by when property transitions is present',
          params: {
            errors: [
              {
                emUsed: true,
                instancePath: '/states/initial',
                keyword: 'not',
                message: 'must NOT be valid',
                params: {},
                schemaPath: '#/dependentSchemas/transitions/allOf/0/not',
              },
            ],
          },
          schemaPath: '#/dependentSchemas/transitions/allOf/0/errorMessage',
        });
      });

      it('should fail if transition has `by` with a null action', () => {
        const scenario = {
          actions: {
            next: {},
          },
          states: {
            initial: {
              on: null,
              by: 'foo',
              goto: '(done)',
            },
          },
        };

        const result = validate(scenario);

        expect(result).to.be.false;
        expect(validate.errors).to.deep.contain({
          instancePath: '/states/initial',
          schemaPath: '#/not',
          keyword: 'not',
          params: {},
          message: 'must NOT be valid',
        });
      });
    });

    describe('wildcard state', () => {
      it('should succeed with a wildcard state', () => {
        const scenario = {
          states: {
            '*': {
              notify: 'logger',
            },
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

      it('should fail with an invalid wildcard state', () => {
        const scenario = {
          states: {
            '*': {
              on: 'abc',
              notify: 'logger',
            },
            initial: {
              on: 'next',
              goto: '(done)',
            },
          },
        };

        const result = validate(scenario);

        expect(result).to.be.false;
        expect(validate.errors).to.deep.contain({
          instancePath: '/states/*',
          schemaPath: '#/dependentRequired',
          keyword: 'dependentRequired',
          params: {
            property: 'on',
            missingProperty: 'goto',
            depsCount: 1,
            deps: 'goto',
          },
          message: 'must have property goto when property on is present',
        });
      });
    });

    describe('end state', () => {
      it('should succeed with an end state', () => {
        const scenario = {
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
