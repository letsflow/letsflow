import { validate } from '../src';
import { expect } from 'chai';

describe('validate', () => {
  describe('validate scenario', () => {
    it('should succeed with a minimal scenario', () => {
      const scenario = {
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

      const result = validate(scenario);

      expect(validate.errors).to.eq(null);
      expect(result).to.be.true;
    });
  });

  describe('validate actors', () => {
    it('should succeed with an actor with some properties', () => {
      const scenario = {
        title: '',
        actors: {
          user: {
            properties: {
              name: { type: 'string' }
            }
          },
        },
        actions: {
          complete: {},
        },
        states: {
          initial: { on: 'complete', goto: '(done)' },
        },
      };

      const result = validate(scenario);

      expect(validate.errors).to.eq(null);
      expect(result).to.be.true;
    });

    it('validate fail with actor of an incorrect type', () => {
      const scenario = {
        title: '',
        actors: {
          user: { type: 'string' }
        },
        actions: {
          complete: {},
        },
        states: {
          initial: { on: 'complete', goto: '(done)' },
        },
      };

      const result = validate(scenario);

      expect(result).to.be.false;
      expect(validate.errors).to.be.deep.contain(  {
        instancePath: '/actors/user/type',
        keyword: 'enum',
        message: 'must be equal to one of the allowed values',
        params: { allowedValues: [ 'object' ] },
        schemaPath: '#/allOf/1/properties/type/enum'
      });
    });

    it('should succeed with a ref to a schema', () => {
      const scenario = {
        title: '',
        actors: {
          user: {
            title: 'User',
            '$ref': 'https://example.com/schemas/person'
          }
        },
        actions: {
          complete: {},
        },
        states: {
          initial: { on: 'complete', goto: '(done)' },
        },
      };

      const result = validate(scenario);

      expect(validate.errors).to.eq(null);
      expect(result).to.be.true;
    });
  });

  describe('validate actions', () => {
    it('should succeed with a standard action', () => {
      const scenario = {
        title: '',
        actions: {
          complete: {
            title: 'Complete',
            description: 'Complete the process',
            actor: 'user',
            responses: {
              one: { title: 'one' },
              two: { title: 'two', update: [ { select: 'assets.reason' } ] },
              three: {
                title: 'two',
                update: {
                  select: 'assets.reason',
                  data: { '<eval>': 'response | { message, code }' },
                  patch: true,
                  if: { '<eval>': "response.types.state | contains(@, 'WA')" }
                }
              }
            },
          }
        },
        states: {
          initial: { on: 'complete', goto: '(done)' },
        },
      };

      const result = validate(scenario);

      expect(validate.errors).to.eq(null);
      expect(result).to.be.true;
    });

    it('should fail if responses is not a map of responses', () => {
      const scenario = {
        title: '',
        actions: {
          complete: {
            responses: { title: 'ok' },
          }
        },
        states: {
          initial: { on: 'complete', goto: '(done)' },
        },
      };

      const result = validate(scenario);

      expect(result).to.be.false;
      expect(validate.errors).to.deep.contain({
        instancePath: '/actions/complete/responses/title',
        keyword: 'type',
        message: 'must be object',
        params: {
          type: 'object',
        },
        schemaPath: '#/type',
      });
    });

    it('should fail update instruction is missing select', () => {
      const scenario = {
        title: '',
        actions: {
          complete: {
            responses: {
              ok: {
                update: {
                  data: 'foo'
                }
              }
            },
          }
        },
        states: {
          initial: { on: 'complete', goto: '(done)' },
        },
      };

      const result = validate(scenario);

      expect(result).to.be.false;
      expect(validate.errors).to.deep.contain(  {
        instancePath: '/actions/complete/responses/ok/update',
        keyword: 'required',
        message: "must have required property 'select'",
        params: {
          missingProperty: 'select',
        },
        schemaPath: '#/required',
      });
    });
  });

  describe('validate states', () => {
    it('should succeed with a simple state', () => {
      const scenario = {
        title: '',
        actions: {
          complete: {},
        },
        states: {
          initial: {
            on: 'complete',
            goto: '(done)'
          }
        },
      };

      const result = validate(scenario);

      expect(validate.errors).to.eq(null);
      expect(result).to.be.true;
    });
  });
});
