import { NormalizedScenario } from '../scenario';
import { StartInstructions } from './interfaces/startInstructions';
import { v4 as uuid } from 'uuid';
import { Actor, InstantiateEvent, Process } from './interfaces/process';
import { hash } from './hash';

export function instantiate(scenario: NormalizedScenario, instructions: StartInstructions): Process {
  const id = uuid();

  const event: Partial<InstantiateEvent> = {
    timestamp: new Date(),
    scenario: instructions.scenario,
    actors: instructions.actors ?? {},
    vars: instructions.vars ?? {},
  };
  event.hash = hash(event);

  return {
    id: id,
    scenario: scenario,
    actors: instantiateActors(scenario, instructions.actors),
    vars: { ...defaultVars(scenario), ...(instructions.vars ?? {}) },
    state: 'initial',
    events: [event as InstantiateEvent],
  };
}

function instantiateActors(
  scenario: NormalizedScenario,
  actors: Record<string, Omit<Actor, 'title'>>,
): Record<string, Actor> {
  const entries = Object.entries(scenario.actors).map(([key, schema]) => {
    const defaults = Object.fromEntries(
      Object.entries(schema.properties ?? {})
        .map(([key, property]) => [key, property.default])
        .filter(([, value]) => value !== undefined),
    );

    return [key, { ...defaults, ...(actors[key] || {}), title: schema.title }];
  });

  return Object.fromEntries(entries);
}

function defaultVars(scenario: NormalizedScenario): Record<string, Actor> {
  const defaults = Object.entries(scenario.vars)
    .map(([key, schema]) => [key, schema.default])
    .filter(([, value]) => value !== undefined);

  return Object.fromEntries(defaults);
}
