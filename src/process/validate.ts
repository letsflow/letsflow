import Ajv from 'ajv';
import { ajv as defaultAjv } from '../ajv';
import { ActorSchema, NormalizedScenario, Schema } from '../scenario';
import { Index } from './interfaces';

export function validateProcess(process: Index, options: { ajv?: Ajv } = {}): string[] {
  const ajv = options.ajv ?? defaultAjv;

  return [
    ...validateTitle(process),
    ...validateActors(ajv, process),
    ...validateVars(ajv, process),
    ...validateResult(ajv, process),
  ];
}

function validateTitle(process: Index): string[] {
  // noinspection SuspiciousTypeOfGuard
  return typeof process.title === 'string' ? [] : ['Title is invalid: must be a string'];
}

function validateActors(ajv: Ajv, process: Index): string[] {
  const errors: string[] = [];

  for (const [key, actor] of Object.entries(process.actors)) {
    const found = findSchema(process.scenario, 'actors', key) as ActorSchema | undefined;
    if (!found) {
      errors.push(`Actor '${key}' is not defined in the scenario`);
      continue;
    }

    const { role: schemaRole, ...schema } = found;

    const valid = ajv.validate(schema, actor);
    if (!valid) {
      errors.push(`Actor '${key}' is invalid: ${ajv.errorsText()}`);
    }

    if (schemaRole && !areRolesEqual(schemaRole, actor.role ?? [])) {
      errors.push(`Role of actor '${key}' must not be changed`);
    }
  }

  for (const key of Object.keys(process.scenario.actors)) {
    if (!key.endsWith('*') && !process.actors[key]) {
      errors.push(`Actor '${key}' is missing`);
    }
  }

  return errors;
}

function validateVars(ajv: Ajv, process: Index): string[] {
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

function validateResult(ajv: Ajv, process: Index): string[] {
  const errors: string[] = [];

  if (process.result) {
    const valid = ajv.validate(process.scenario.result, process.result);
    if (!valid) {
      errors.push(`Result is invalid: ${ajv.errorsText()}`);
    }
  }

  return errors;
}

function findSchema(scenario: NormalizedScenario, property: string, key: string): Schema | undefined {
  return scenario[property][key] ? scenario[property][key] : (scenario[property][key.replace(/\d+$/, '*')] ?? {});
}

function areRolesEqual(a: string | string[], b: string | string[]): boolean {
  const normalize = (role: string | string[]): string[] => (Array.isArray(role) ? role.sort() : [role]);

  const roleA = normalize(a);
  const roleB = normalize(b);

  return roleA.length === roleB.length && roleA.every((value, index) => value === roleB[index]);
}
