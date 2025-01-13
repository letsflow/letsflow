import Ajv from 'ajv';
import { ajv as defaultAjv } from '../ajv';
import { NormalizedScenario } from '../scenario';
import { Process } from './interfaces/process';

export function validateProcess(process: Process, options: { ajv?: Ajv } = {}): string[] {
  const ajv = options.ajv ?? defaultAjv;

  return [
    ...validateTitle(process),
    ...validateActors(ajv, process),
    ...validateVars(ajv, process),
    ...validateResult(ajv, process),
  ];
}

function validateTitle(process: Process): string[] {
  // noinspection SuspiciousTypeOfGuard
  return typeof process.title === 'string' ? [] : ['Title is invalid: must be a string'];
}

function validateActors(ajv: Ajv, process: Process): string[] {
  const errors: string[] = [];

  for (const [key, actor] of Object.entries(process.actors)) {
    const schema = findSchema(process.scenario, 'actors', key);
    if (!schema) {
      errors.push(`Actor '${key}' is not defined in the scenario`);
      continue;
    }

    const valid = ajv.validate(schema, actor);
    if (!valid) {
      errors.push(`Actor '${key}' is invalid: ${ajv.errorsText()}`);
    }
  }

  for (const key of Object.keys(process.scenario.actors)) {
    if (!key.endsWith('*') && !process.actors[key]) {
      errors.push(`Actor '${key}' is missing`);
    }
  }

  return errors;
}

function validateVars(ajv: Ajv, process: Process): string[] {
  const errors: string[] = [];

  for (const [key, value] of Object.entries(process.vars)) {
    const schema = findSchema(process.scenario, 'vars', key);
    if (!schema) {
      errors.push(`Variable '${key}' is not defined in the scenario`);
      continue;
    }

    const valid = ajv.validate(schema, value);
    if (!valid) {
      errors.push(`Variable '${key}' is invalid: ${ajv.errorsText()}`);
    }
  }

  return errors;
}

function validateResult(ajv: Ajv, process: Process): string[] {
  const errors: string[] = [];

  if (process.result) {
    const valid = ajv.validate(process.scenario.result, process.result);
    if (!valid) {
      errors.push(`Result is invalid: ${ajv.errorsText()}`);
    }
  }

  return errors;
}

function findSchema(scenario: NormalizedScenario, property: string, key: string) {
  return scenario[property][key] ? scenario[property][key] : scenario[property][key.replace(/\d+$/, '*')];
}
