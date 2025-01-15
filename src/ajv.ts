import Ajv from 'ajv/dist/2020';
import { actionSchema, actorSchema, fnSchema, scenarioSchema, schemaSchema } from './schemas/v1.0.0';

export const ajv = new Ajv({
  allErrors: true,
  loadSchema: async (uri) => {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(`Failed to fetch schema at ${uri}`);
    }
    return response.json(); // Return the schema as a JSON object
  },
});

ajv.addKeyword('$anchor'); // Workaround for https://github.com/ajv-validator/ajv/issues/1854
ajv.addSchema([scenarioSchema, actionSchema, actorSchema, fnSchema, schemaSchema]);
