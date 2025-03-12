import ajvErrors from 'ajv-errors';
import ajvFormats from 'ajv-formats';
import Ajv from 'ajv/dist/2020';
import { actionSchema, actorSchema, fnSchema, processSchema, scenarioSchema, schemaSchema } from './schemas/v1.0';

async function loadSchema(uri: string) {
  const response = await fetch(uri);
  if (!response.ok) {
    if (console) console.warn(`Failed to fetch schema at ${uri}: ${response.status} ${response.statusText}`);
    return {};
  }

  try {
    return await response.json();
  } catch (error) {
    if (console) console.warn(`Failed to parse schema at ${uri}: ${error}`);
    return {};
  }
}

export const ajv = new Ajv({
  allErrors: true,
  loadSchema,
  schemas: [scenarioSchema, actionSchema, actorSchema, fnSchema, schemaSchema, processSchema],
});

ajv.addKeyword('$anchor'); // Workaround for https://github.com/ajv-validator/ajv/issues/1854

ajvFormats(ajv);
ajvErrors(ajv);
