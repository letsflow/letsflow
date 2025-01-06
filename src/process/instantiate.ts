import { v4 as uuid } from 'uuid';
import { ActorSchema, NormalizedAction, NormalizedScenario, Transition } from '../scenario';
import { applyFn } from './fn';
import { withHash } from './hash';
import { Action, Actor, InstantiateEvent, Notify, Process, StartInstructions, State } from './interfaces/process';

export function instantiate(scenario: NormalizedScenario, instructions: StartInstructions): Process {
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
    actors: instantiateActors(scenario.actors, event.actors),
    vars: { ...defaultVars(scenario.vars), ...event.vars },
    result: scenario.result.default ?? null,
    events: [event],
  };

  const current = instantiateState(scenario, 'initial', process, event.timestamp);

  return { ...process, current };
}

function instantiateActors(
  schemas: Record<string, ActorSchema>,
  actors: Record<string, Omit<Actor, 'title' | 'role'>>,
): Record<string, Actor> {
  const keys = dedup([...Object.keys(schemas).filter((key) => !key.endsWith('*')), ...Object.keys(actors)]);
  const result: Record<string, Actor> = {};

  for (const key of keys) {
    const schema = schemas[key] ?? schemas[key.replace(/\d+$/, '*')];
    if (!schema) throw new Error(`Invalid start instructions: Actor '${key}' not found in scenario`);

    result[key] = {
      title: schema.title ?? key,
      ...defaultVars(schema.properties ?? {}),
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

function defaultVars(vars: Record<string, any>): Record<string, any> {
  const defaults = Object.entries(vars)
    .map(([key, schema]) => [key, schema.default])
    .filter(([, value]) => value !== undefined);

  return Object.fromEntries(defaults);
}

function dedup<T>(array: Array<T>): Array<T> {
  return Array.from(new Set(array));
}
