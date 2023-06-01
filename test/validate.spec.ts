import {validate, Scenario, normalize} from '../src';
import { expect } from 'chai';

describe('validate', () => {
  describe('validate scenario', () => {
    it('should succeed with a minimal scenario', () => {
      const scenario = {
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

      const result = validate(scenario);

      expect(validate.errors).to.be.eq(null);
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
        actions: {},
        states: {},
      };

      const result = validate(scenario);

      expect(validate.errors).to.be.eq(null);
      expect(result).to.be.true;
    });

    it('validate fail with actor of an incorrect type', () => {
      const scenario = {
        title: '',
        actors: {
          user: { type: 'string' }
        },
        actions: {},
        states: {},
      };

      const result = validate(scenario);

      expect(result).to.be.false;
      expect(validate.errors).to.be.deep.eq(  [{
        instancePath: "/actors/user/type",
        keyword: "enum",
        message: "must be equal to one of the allowed values",
        params: { allowedValues: [ "object" ] },
        schemaPath: "#/allOf/1/properties/type/enum"
      }]);
    });
  });
});
