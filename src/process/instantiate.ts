import Ajv from 'ajv';
import { v4 as uuid } from 'uuid';
import { ajv as defaultAjv } from '../ajv';
import { ActorSchema, NormalizedAction, NormalizedScenario, Schema, Transition } from '../scenario';
import { applyFn } from './fn';
import { withHash } from './hash';
import { Action, Actor, InstantiateEvent, Notify, Process, StartInstructions, State } from './interfaces/process';

export function instantiate(
  scenario: NormalizedScenario,
  instructions: StartInstructions,
  options: { ajv?: Ajv } = {},
): Process {
  const event: InstantiateEvent = withHash({
    id: uuid(),
    timestamp: new Date(),
    scenario: instructions.scenario,
    actors: instructions.actors ?? {},
    vars: instructions.vars ?? {},
  });

  const process: Omit<Process, 'current'> = {
    id: event.id,
    title: scenario.title ?? `Process ${event.id}`,
    tags: scenario.tags,
    scenario: { id: instructions.scenario, ...scenario },
    actors: instantiateActors(scenario.actors, event.actors, options),
    vars: { ...defaultValues(scenario.vars, options), ...event.vars },
    result: scenario.result ? defaultValue(scenario.result, options) ?? null : null,
    events: [event],
  };

  const current = instantiateState(scenario, 'initial', process, event.timestamp);

  return { ...process, current };
}

function instantiateActors(
  schemas: Record<string, ActorSchema>,
  actors: Record<string, Omit<Actor, 'title' | 'role'>>,
  options: { ajv?: Ajv } = {},
): Record<string, Actor> {
  const keys = dedup([...Object.keys(schemas).filter((key) => !key.endsWith('*')), ...Object.keys(actors)]);
  const result: Record<string, Actor> = {};

  for (const key of keys) {
    const schema = schemas[key] ?? schemas[key.replace(/\d+$/, '*')];
    if (!schema) throw new Error(`Invalid start instructions: Actor '${key}' not found in scenario`);

    result[key] = {
      title: schema.title ?? key,
      ...defaultValue(schema, options),
      ...(actors[key] || {}),
      ...(schema.role ? { role: schema.role } : {}),
    } as Actor;
  }

  return result;
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
  state.notify = (state.notify as Array<Notify & { if: boolean }>).filter((notify) => notify.if)

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

function defaultValues(vars: Record<string, any>, options: { ajv?: Ajv } = {}): Record<string, any> {
  const defaults = Object.entries(vars)
    .map(([key, schema]) => [key, defaultValue(schema, options)])
    .filter(([, value]) => value !== undefined);

  return Object.fromEntries(defaults);
}

export function defaultValue(schema: Schema | string, options: { ajv?: Ajv } = {}): any {
  if (typeof schema === 'string' && !schema.startsWith('https:')) {
    return undefined;
  }

  if (typeof schema === 'string' || schema.$ref) {
    const uri = typeof schema === 'string' ? schema : schema.$ref!;
    const ajv = options.ajv ?? defaultAjv;
    const refSchema = ajv.getSchema(uri)?.schema
    return refSchema ? defaultValue(refSchema as any, options) : undefined;
  }

  if (schema.default !== undefined) {
    return schema.default;
  }

  if (schema.properties) {
    return defaultValues(schema.properties);
  }

  return undefined;
}

function dedup<T>(array: Array<T>): Array<T> {
  return Array.from(new Set(array));
}
