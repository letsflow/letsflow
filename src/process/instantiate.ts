import Ajv from 'ajv';
import { v4 as uuid } from 'uuid';
import { ajv as defaultAjv } from '../ajv';
import { NormalizedAction, NormalizedScenario, Schema, Transition } from '../scenario';
import { applyFn } from './fn';
import { withHash } from './hash';
import { Action, Actor, InstantiateEvent, Notify, Process, StartInstructions, State } from './interfaces/process';
import { validateProcess } from './validate';

const errorState = {
  key: '(error)',
  title: 'Error',
  description: 'The process failed to start',
  instructions: {},
  actions: [],
  notify: [],
};

export function instantiate(
  scenario: NormalizedScenario,
  instructions: StartInstructions,
  options: { ajv?: Ajv } = {},
): Process {
  const id = uuid();

  const process: Omit<Process, 'current'> = {
    id,
    title: scenario.title ?? `Process ${id}`,
    tags: scenario.tags,
    scenario: { id: instructions.scenario, ...scenario },
    actors: instantiateActors(scenario.actors, instructions.actors ?? {}, options),
    vars: { ...defaultValues(scenario.vars, options), ...(instructions.vars ?? {}) },
    result: scenario.result ? defaultValue(scenario.result, options) ?? null : null,
    events: [],
  };

  const event: InstantiateEvent = withHash({
    id,
    timestamp: new Date(),
    scenario: instructions.scenario,
    actors: process.actors,
    vars: process.vars,
    result: process.result,
  });

  process.events.push(event);

  const current = instantiateState(scenario, 'initial', process, event.timestamp);
  const instantiated: Process = { ...process, current };

  const errors = validateProcess(instantiated, options);

  if (errors.length > 0) {
    instantiated.events[0] = withHash({ ...event, errors });
    instantiated.current = { ...errorState, timestamp: event.timestamp };
  }

  return instantiated;
}

function instantiateActors(
  schemas: Record<string, Schema>,
  values: Record<string, Omit<Actor, 'title' | 'role'>>,
  options: { ajv?: Ajv } = {},
): Record<string, Actor> {
  const keys = dedup([...Object.keys(schemas).filter((key) => !key.endsWith('*')), ...Object.keys(values)]);
  const result: Record<string, Actor> = {};

  for (const key of keys) {
    result[key] = instantiateActor(schemas, key, values[key] ?? {}, options);
  }

  return result;
}

export function instantiateActor(
  schemas: Record<string, Schema>,
  key: string,
  values: Record<string, any>,
  options: { ajv?: Ajv } = {},
): Actor {
  const schemaKey = key in schemas ? key : key.replace(/\d+$/, '*');
  const schema = schemas[schemaKey];
  if (!schema) throw new Error(`Actor '${key}' not found in scenario`);

  const title = schema.title
    ? schema.title + (schemaKey.endsWith('*') ? ' ' + key.slice(schemaKey.length - 1) : '')
    : key.replace('_', ' ').trim();

  return {
    title,
    ...defaultValue(schema, options),
    ...values,
    ...(schema.role ? { role: schema.role } : {}),
  };
}

export function instantiateState(
  scenario: NormalizedScenario,
  key: string,
  process: Omit<Process, 'current'>,
  timestamp?: Date,
): State {
  const scenarioState = scenario.states[key];
  if (!scenarioState) throw new Error(`State '${key}' not found in scenario`);

  const state: State = applyFn(scenarioState, process);

  state.key = key;
  state.timestamp = timestamp ?? new Date();
  state.actions = ((state.transitions ?? []) as Transition[])
    .filter((transition) => 'on' in transition)
    .map((transition) => transition.on)
    .map((k: string): Action => {
      const action = scenario.actions[`${key}.${k}`] ?? scenario.actions[k];
      if (!action) {
        throw new Error(`Action '${k}' is used in state '${key}', but not defined in the scenario`);
      }
      return instantiateAction(k, action, process);
    })
    .filter((action: Action) => action.if);
  state.notify = (state.notify as Array<Notify & { if: boolean }>).filter((notify) => notify.if);

  return state;
}

export function instantiateAction(key: string, action: NormalizedAction, process: Omit<Process, 'current'>): Action {
  const { update: _, ...scenarioAction } = action;
  const processAction: Action = { ...applyFn(scenarioAction, process), key };

  // noinspection SuspiciousTypeOfGuard
  if (typeof processAction.actor === 'string') {
    processAction.actor = [processAction.actor];
  } else if (!processAction.actor) {
    processAction.actor = [];
  }

  return processAction;
}

function defaultValues(vars: Record<string, any>, options: { ajv?: Ajv; base?: Schema } = {}): Record<string, any> {
  const defaults = Object.entries(vars)
    .map(([key, schema]) => [key, defaultValue(schema, options)])
    .filter(([, value]) => value !== undefined);

  return Object.fromEntries(defaults);
}

export function defaultValue(schema: Schema | string, options: { ajv?: Ajv; base?: Schema } = {}): any {
  if (typeof schema === 'string' && !schema.startsWith('https:')) {
    return undefined;
  }

  const ajv = options.ajv ?? defaultAjv;
  const base = options.base ?? (typeof schema !== 'string' ? schema : undefined);

  if (typeof schema === 'string' || schema.$ref) {
    const uri = typeof schema === 'string' ? schema : schema.$ref!;
    const resolvedSchema = resolveRef(ajv, uri, base);
    return resolvedSchema ? defaultValue(resolvedSchema, options) : undefined;
  }

  if (schema.default !== undefined) {
    return schema.default;
  }

  if (schema.const !== undefined) {
    return schema.const;
  }

  if ((schema.type ?? 'object') === 'object' && schema.properties) {
    const value = defaultValues(schema.properties, { ajv, base });
    return Object.keys(value).length > 0 ? value : undefined;
  }

  return undefined;
}

function resolveRef(ajv: Ajv, uri: string, base?: Schema): Schema | undefined {
  const [baseUri, pointer] = uri.split('#');
  const refSchema = baseUri ? ajv.getSchema(baseUri)?.schema : base;

  if (refSchema && pointer) {
    const segments = pointer.split('/').filter((segment) => segment); // Remove empty parts
    return segments.reduce((subSchema: any, segment) => subSchema?.[segment], refSchema);
  }

  return refSchema as Schema | undefined;
}

function dedup<T>(array: Array<T>): Array<T> {
  return Array.from(new Set(array));
}
