import Ajv from 'ajv';
import { v4 as uuidv4 } from 'uuid';
import { ajv as defaultAjv } from '../ajv';
import { NormalizedAction, NormalizedScenario, Schema, Transition } from '../scenario/interfaces';
import { uuid } from '../uuid';
import { applyFn } from './fn';
import { withHash } from './hash';
import { Action, Actor, HashFn, InstantiateEvent, Notify, Process, State } from './interfaces';

export function instantiate(
  scenario: NormalizedScenario & { id?: string },
  options: { hashFn?: HashFn; idFn?: () => string; ajv?: Ajv } = {},
): Process {
  const hashFn = options.hashFn ?? withHash;

  const process = createProcess(scenario, options);

  const event = hashFn<InstantiateEvent>({
    id: process.id,
    timestamp: new Date(),
    scenario: process.scenario.id,
  });
  process.events.push(event);

  const current = instantiateState(process, 'initial', event.timestamp);

  return { ...process, current };
}

export function createProcess(
  scenario: NormalizedScenario,
  options: { idFn?: () => string; ajv?: Ajv } = {},
): Omit<Process, 'current'> {
  const id = (options.idFn ?? uuidv4)();
  const scenarioId = scenario.id ?? uuid(scenario);

  return {
    id,
    title: scenario.title ?? `Process ${id}`,
    tags: scenario.tags,
    scenario: { id: scenarioId, ...scenario },
    actors: instantiateActors(scenario.actors, {}, options),
    vars: defaultValues(scenario.vars, options),
    result: scenario.result ? (defaultValue(scenario.result, options) ?? null) : null,
    events: [],
    previous: [],
  };
}

export function instantiateActors(
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

export function instantiateState(process: Omit<Process, 'current'>, key: string, timestamp?: Date): State {
  const scenario = process.scenario;
  const scenarioState = scenario.states[key];
  if (!scenarioState) throw new Error(`State '${key}' not found in scenario`);

  const state: State = applyFn(scenarioState, process);

  state.key = key;
  state.timestamp = timestamp ?? new Date();

  const actions = ((state.transitions ?? []) as Transition[])
    .filter((transition) => 'on' in transition)
    .filter((transition) => transition.if as boolean)
    .reduce(
      (acc, transition) => {
        const { on, by } = transition;
        acc[on] ??= [];
        acc[on].push(...(by as string[]));
        return acc;
      },
      {} as Record<string, string[]>,
    );

  state.actions = Object.entries(actions)
    .map(([on, by]): Action & { if: boolean } => {
      const action = scenario.actions[`${key}.${on}`] ?? scenario.actions[on];
      if (!action) {
        throw new Error(`Action '${on}' is used in state '${key}', but not defined in the scenario`);
      }
      return instantiateAction(process, on, action, by as string[]);
    })
    .filter((action) => action.if)
    .map((action) => {
      const { if: _, ...rest } = action;
      return rest;
    });

  state.notify = ((state.notify ?? []) as Array<Notify & { if: boolean }>)
    .filter((notify) => notify.if)
    .map((notify): Notify => {
      const { if: _, ...rest } = notify;
      return rest;
    });

  delete state.transitions;

  return state;
}

export function instantiateAction(
  process: Omit<Process, 'current'>,
  key: string,
  action?: NormalizedAction,
  by?: string[],
): Action & { if: boolean } {
  const { update: _, ...scenarioAction } = action ?? process.scenario.actions[key];
  const processAction: Action & { if: boolean } = { ...applyFn(scenarioAction, process), key };

  if (by?.includes('*')) by = undefined;

  // noinspection SuspiciousTypeOfGuard
  if (typeof processAction.actor === 'string') {
    processAction.actor = [processAction.actor];
  } else if (!processAction.actor) {
    processAction.actor = [];
  }

  processAction.actor = processAction.actor
    .map((actor) => {
      if (actor === '*') return Object.keys(process.actors);
      if (actor.endsWith('*')) {
        return Object.keys(process.actors).filter((key) => key.replace(/\d+$/, '*') === actor);
      }
      if (actor in process.actors) return [actor];
      return [];
    })
    .flat()
    .filter((actor) => !by || by.includes(actor) || by.includes(actor.replace(/\d+$/, '*')));

  processAction.if = processAction.if && processAction.actor.length > 0;

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
