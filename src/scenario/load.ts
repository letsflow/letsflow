import Ajv from 'ajv';
import { ajv as defaultAjv } from '../ajv';
import { NormalizedScenario } from './interfaces/normalized';
import { Schema } from './interfaces/scenario';

export async function loadSchemas(scenario: NormalizedScenario, options: { ajv?: Ajv } = {}): Promise<void> {
  const ajv = options.ajv ?? defaultAjv;

  const schemas = [
    ...Object.values(scenario.actors),
    ...Object.values(scenario.vars),
    ...(scenario.result ? [scenario.result] : []),
    ...getResponseSchemas(scenario),
  ];

  const combinedSchema = {
    oneOf: schemas.filter((schema) => Object.keys(schema).length > 0),
  };

  await ajv.compileAsync(combinedSchema);
}

function getResponseSchemas(scenario: NormalizedScenario): Schema[] {
  return Object.values(scenario.actions ?? {})
    .map((action) => action.response)
    .filter((response): response is Schema => response !== null);
}
