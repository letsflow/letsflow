import Ajv from 'ajv/dist/2020';
import scenarioSchema from './schemas/v0.3.0/scenario.json';
import actionSchema from './schemas/v0.3.0/action.json';
import fnSchema from './schemas/v0.3.0/fn.json';

const ajv = new Ajv();

ajv.addSchema(actionSchema);
ajv.addSchema(fnSchema);

export const validate = ajv.compile(scenarioSchema);
