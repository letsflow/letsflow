import Ajv from 'ajv/dist/2020';
import { NormalizedScenario } from '../scenario/interfaces';
import { uuid } from '../uuid';
import { applyFn } from './fn';
import { withHash } from './hash';
import { createProcess, instantiateState } from './instantiate';
import { ActionEvent, Event, HashFn, InstantiateEvent, Process } from './interfaces';
import { findActionTransition, findTimeoutTransition, logTransition, update, validateStep } from './step';
import { isActionEvent, isInstantiateEvent, isTimeoutEvent } from './utils';
import { validateProcess } from './validate';

export function replay(
  input: Process | NormalizedScenario,
  events: Event[],
  options: {
    ajv?: Ajv;
    callback?: (process: Process, event: Event) => void;
  } = {},
): Process {
  const { callback } = options;
  const isProcess = 'current' in input;

  if (!isProcess && !isInstantiateEvent(events[0])) {
    throw new Error('First event must be an instantiate event when replaying from genesis');
  }

  const process = isProcess
    ? structuredClone(input as Process)
    : replayInstantiate(input, events[0] as InstantiateEvent, options);

  for (const event of isProcess ? events : events.slice(1)) {
    if (isInstantiateEvent(event)) {
      throw new Error('Cannot replay an instantiate event');
    }

    const previous = process.events[process.events.length - 1];

    if (event.previous !== previous.hash) {
      throw new Error(
        `Event ${event.hash} does not follow previous event; expected ${previous.hash}, got ${event.previous}`,
      );
    }

    if (callback) {
      callback(structuredClone(process), event);
    }

    if (isActionEvent(event) && !event.skipped) {
      replayAction(process, event, options);
    }

    if (isTimeoutEvent(event)) {
      replayTimeout(process, event);
    }
  }

  return process;
}

function replayInstantiate(
  scenario: NormalizedScenario & { id?: string },
  event: InstantiateEvent,
  options: { ajv?: Ajv } = {},
): Process {
  const scenarioId = scenario.id ?? uuid(scenario);

  if (event.scenario !== scenarioId) {
    throw new Error(`Event scenario id '${event.scenario}' does not match scenario id '${scenarioId}'`);
  }

  const process = createProcess(scenario, { ...options, idFn: () => event.id });
  process.events.push(event);

  const current = instantiateState(process, 'initial', event.timestamp);

  return { ...process, current };
}

function replayAction(process: Process, event: ActionEvent, options: { ajv?: Ajv } = {}) {
  process.current.response = event.response;
  process.current.actor = process.actors[event.actor.key];
  process.current.action = process.current.actions.find((action) => action.key === event.action)!;

  process.events.push(event);

  const stepErrors = validateStep(process, event.action, event.actor, event.response, options);
  if (stepErrors.length > 0) {
    throw new Error(`Event ${event.hash} should have been skipped:\n${stepErrors.join('\n')}`);
  }

  const currentAction =
    process.scenario.actions[`${process.current.key}.${event.action}`] || process.scenario.actions[event.action];

  for (const scenarioInstructions of currentAction.update) {
    const instructions = applyFn(scenarioInstructions, process);
    if (!instructions.if) continue;

    update(process, instructions, event.actor.key, options);
  }

  const updateErrors = validateProcess(process, options);

  const next = findActionTransition(process, event.action, event.actor.key);
  if (!next) {
    updateErrors.push(
      `No transition found for action '${event.action}' in state '${process.current.key}' for actor` +
        (event.actor.key === 'actor' ? '' : ` '${event.actor.key}'`),
    );
  }

  if (updateErrors.length > 0) {
    throw new Error(`Event ${event.hash} should have been skipped:\n${updateErrors.join('\n')}`);
  }

  logTransition(process, next!);

  process.current = instantiateState(
    process,
    next!.goto ?? process.current.key,
    next!.goto ? event.timestamp : process.current.timestamp,
  );
}

function replayTimeout(process: Process, event: Event) {
  const timePassed = event.timestamp.getTime() - process.events[process.events.length - 1].timestamp.getTime();

  process.events.push(event);
  const next = findTimeoutTransition(process, timePassed);

  if (!next) {
    throw new Error(`Timeout event ${event.hash} should not have been triggered`);
  }

  logTransition(process, next);

  if (next.goto !== null) {
    process.current = instantiateState(process, next.goto, event.timestamp);
  }
}

export function migrate(
  scenario: NormalizedScenario,
  events: Event[],
  options: { ajv?: Ajv; hashFn?: HashFn } = {},
): Process {
  if (!isInstantiateEvent(events[0])) {
    throw new Error('First event must be an instantiate event when migrating');
  }

  const hashFn = options.hashFn ?? withHash;

  events[0].scenario = scenario.id ?? uuid(scenario);
  let previous = '';

  const migrated = events.map((event) => {
    if (!isInstantiateEvent(event)) {
      event.previous = previous;
    }

    const migratedEvent = hashFn(event);
    previous = migratedEvent.hash;

    return migratedEvent;
  });

  return replay(scenario, migrated, options);
}
