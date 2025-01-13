import Ajv from 'ajv/dist/2020';
import { actionSchema, actorSchema, fnSchema, scenarioSchema, schemaSchema } from './schemas/v1.0.0';

export const ajv = new Ajv({ allErrors: true });
ajv.addKeyword('$anchor'); // Workaround for https://github.com/ajv-validator/ajv/issues/1854
ajv.addSchema([scenarioSchema, actionSchema, actorSchema, fnSchema, schemaSchema]);
