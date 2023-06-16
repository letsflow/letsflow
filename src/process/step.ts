import { ActionEvent, Process, TimeoutEvent } from './interfaces/process';
import { withHash } from './hash';
import { ExplicitState, Transition } from '../scenario';
import { applyFn } from './fn';
import get from 'get-value';
import set from 'set-value';
import { instantiateState } from './instantiate';

interface InstantiatedUpdateInstructions {
  path: string;
  data: any;
  merge: boolean;
  if: boolean;
}

/**
 * Step the process forward by one action.
 * Return `true` if the process changed state.
 */
export function step(input: Process, action: string, actor: string, response?: any): Process {
  const process = structuredClone(input);

  const current = process.scenario.states[process.current.key];
  if (!('transitions' in current)) throw new Error(`Process is in end state '${process.current.key}'`);

  assertStep(process, current, action, actor);

  const event: ActionEvent = withHash({
    previous: process.events[process.events.length - 1].hash,
    timestamp: new Date(),
    action,
    actor: { key: actor, id: process.actors[actor].id as string },
    response,
  });

  process.response = response;
  process.events.push(event);

  process.scenario.actions[action].update.forEach((scenarioInstructions) => {
    const instructions: InstantiatedUpdateInstructions = applyFn(scenarioInstructions, process);
    if (!instructions.if) return;
    update(process, instructions.path, instructions.data, instructions.merge);
  });

  const next = current.transitions
    .filter((transition: Transition) => 'on' in transition)
    .find((transition: Transition & { on: string }) => {
      const tr: Transition & { on: string } = applyFn(transition, process);
      return tr.if && tr.on === action;
    });

  process.current = instantiateState(
    process.scenario,
    next?.goto || process.current.key,
    process,
    next ? event.timestamp : process.current.timestamp,
  );

  return process;
}

function assertStep(process: Process, current: Required<ExplicitState>, action: string, actor: string) {
  if (!current.actions.includes(action)) {
    throw new Error(`Action '${action}' is not allowed in state '${process.current.key}'`);
  }

  if (!Object.keys(process.actors).includes(actor)) {
    throw new Error(`Actor '${actor}' is not defined in the scenario`);
  }

  if (!process.actors[actor].id) {
    throw new Error(`Actor '${actor}' is not assigned to a user`);
  }

  if (!process.scenario.actions[action].actor.includes(actor)) {
    throw new Error(`Actor '${actor}' is not allowed to perform action '${action}'`);
  }
}

/**
 * Step the process forward in case of a timeout.
 */
export function timeout(process: Process) {
  const current = process.scenario.states[process.current.key];
  if (!('transitions' in current)) throw new Error(`Process is in end state '${process.current.key}'`);

  const timestamp = new Date();
  const timeout = timestamp.getTime() - process.current.timestamp.getTime();

  const next = current.transitions
    .filter((transition: Transition) => 'after' in transition)
    .find((transition: Transition & { after: number }) => {
      const tr: Transition & { after: number } = applyFn(transition, process);
      return tr.if && tr.after <= timeout;
    });

  if (!next) return; // No timeout transition

  const event: TimeoutEvent = withHash({
    previous: process.events[process.events.length - 1].hash,
    timestamp,
  });

  delete process.response;
  process.events.push(event);
  process.current = instantiateState(process.scenario, next.goto, process, event.timestamp);
}

function update(process: Process, path: string, data: any, merge: boolean): void {
  if (!['title', 'actors', 'vars'].includes(path.split('.')[0])) {
    throw new Error(`Not allowed to set '${path}' through update instructions`);
  }

  if (merge) {
    const current: any = get(process, path);

    if (Array.isArray(current) && Array.isArray(data)) {
      data = [...current, ...data];
    } else if (typeof current === 'object' && typeof data === 'object') {
      data = { ...current, ...data };
    }
  }

  set(process, path, data);
}
