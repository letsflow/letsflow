export * from './interfaces/scenario';
export { normalize } from './normalize';
export { validate } from './validate';
export { uuid } from './uuid';
export * as yaml from './yaml';

import fnSchema from './schemas/v1.0.0/action.json';
import actionSchema from './schemas/v1.0.0/action.json';
import scenarioSchema from './schemas/v1.0.0/action.json';

export const schemas = {
  'v1.0.0': {
    fn: fnSchema,
    action: actionSchema,
    scenario: scenarioSchema,
  },
};
