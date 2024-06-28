import { NormalizedAction, NormalizedScenario, Schema } from '../scenario';
import { v4 as uuid } from 'uuid';
import { Action, Actor, InstantiateEvent, Process, StartInstructions, State } from './interfaces/process';
import { withHash } from './hash';
import { applyFn } from './fn';

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
    title: scenario.title,
    scenario,
    actors: instantiateActors(scenario.actors, event.actors),
    vars: { ...defaultVars(scenario.vars), ...event.vars },
    events: [event],
  };

  const current = instantiateState(scenario, 'initial', process, event.timestamp);

  return { ...process, current };
}

function instantiateActors(
  schemas: Record<string, Schema>,
  actors: Record<string, Omit<Actor, 'title'>>,
): Record<string, Actor> {
  const definedActors = Object.keys(schemas);

  for (const key of Object.keys(actors)) {
    const found =
      definedActors.includes(key) || definedActors.some((k) => k.endsWith('*') && key.startsWith(k.slice(0, -1)));
    if (!found) throw new Error(`Actor '${key}' not found in scenario`);
  }

  const entries = Object.entries(schemas)
    .filter(([key]) => !key.endsWith('*'))
    .map(([key, schema]) => [
      key,
      {
        ...defaultVars(schema.properties ?? {}),
        ...(actors[key] || {}),
        title: schema.title,
      },
    ]);

  return Object.fromEntries(entries);
}

export function instantiateState(
  scenario: NormalizedScenario,
  key: string,
  process: Omit<Process, 'current'>,
  timestamp: Date,
): State {
  const state = scenario.states[key];
  if (!state) throw new Error(`State '${key}' not found in scenario`);

  const actionKeys = 'actions' in state ? state.actions : [];
  const actions = actionKeys.map((k) => {
    if (!(k in scenario.actions)) {
      throw new Error(`Action '${k}' is used in state '${key}', but not defined in the scenario`);
    }

    return instantiateAction(k, scenario.actions[k], process);
  });

  return {
    key,
    timestamp,
    title: applyFn(state.title, process),
    description: applyFn(state.description, process),
    instructions: applyFn(state.instructions, process),
    actions,
  };
}

function instantiateAction(key: string, action: NormalizedAction, process: Omit<Process, 'current'>): Action {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { update, ...scenarioAction } = action;

  return { ...applyFn(scenarioAction, process), key };
}

function defaultVars(vars: Record<string, any>): Record<string, any> {
  const defaults = Object.entries(vars)
    .map(([key, schema]) => [key, schema.default])
    .filter(([, value]) => value !== undefined);

  return Object.fromEntries(defaults);
}
