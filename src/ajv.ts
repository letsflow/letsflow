import ajvFormats from 'ajv-formats';
import Ajv from 'ajv/dist/2020';
import { actionSchema, actorSchema, fnSchema, scenarioSchema, schemaSchema } from './schemas/v1.0';

export const ajv = new Ajv({
  allErrors: true,
  loadSchema: async (uri) => {
    const response = await fetch(uri);
    if (!response.ok) {
      console && console.warn(`Failed to fetch schema at ${uri}: ${response.status} ${response.statusText}`);
      return {};
    }

    try {
      return await response.json();
    } catch (error) {
      console && console.warn(`Failed to parse schema at ${uri}: ${error}`);
      return {};
    }
  },
});

ajv.addKeyword('$anchor'); // Workaround for https://github.com/ajv-validator/ajv/issues/1854
ajv.addSchema([scenarioSchema, actionSchema, actorSchema, fnSchema, schemaSchema]);

ajvFormats(ajv);
