import { NormalizedScenario, Schema } from '../scenario';
import { v4 as uuid } from 'uuid';
import { Actor, InstantiateEvent, Process, StartInstructions } from './interfaces/process';
import { hash } from './hash';

export function instantiate(scenario: NormalizedScenario, instructions: StartInstructions): Process {
  const event = createInstantiateEvent(instructions);

  return {
    id: event.id,
    scenario,
    actors: instantiateActors(scenario.actors, event.actors),
    vars: { ...defaultVars(scenario.vars), ...event.vars },
    state: 'initial',
    events: [event as InstantiateEvent],
  };
}

function createInstantiateEvent(instructions: StartInstructions): InstantiateEvent {
  const event: Partial<InstantiateEvent> = {
    id: uuid(),
    timestamp: new Date(),
    scenario: instructions.scenario,
    actors: instructions.actors ?? {},
    vars: instructions.vars ?? {},
  };
  event.hash = hash(event);

  return event as InstantiateEvent;
}

function instantiateActors(
  schemas: Record<string, Schema>,
  actors: Record<string, Omit<Actor, 'title'>>,
): Record<string, Actor> {
  for (const key in Object.keys(actors)) {
    const found = Object.keys(schemas).some(([k]) => k === key || (k.endsWith('*') && key.startsWith(k.slice(0, -1))));
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

function defaultVars(vars: Record<string, any>): Record<string, any> {
  const defaults = Object.entries(vars)
    .map(([key, schema]) => [key, schema.default])
    .filter(([, value]) => value !== undefined);

  return Object.fromEntries(defaults);
}
