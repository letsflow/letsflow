import Ajv from 'ajv/dist/2020';
import get from 'get-value';
import set from 'set-value';
import { ajv as defaultAjv } from '../ajv';
import { NormalizedTransition, Transition } from '../scenario';
import { applyFn } from './fn';
import { withHash } from './hash';
import { instantiateAction, instantiateState } from './instantiate';
import { ActionEvent, Process, TimeoutEvent } from './interfaces/process';
import { validateProcess } from './validate';

interface InstantiatedUpdateInstructions {
  set: string;
  data: any;
  mode: 'replace' | 'merge' | 'append';
  if: boolean;
}

interface StepActor {
  key: string;
  id?: string;
  roles?: string[];
}

/**
 * Step the process forward by one action.
 * @return The updated process.
 */
export function step(
  input: Process,
  action: string,
  actor: StepActor | string = 'actor',
  response?: any,
  options: {
    hashFn?: typeof withHash,
    ajv?: Ajv,
  } = {},
): Process {
  const process = structuredClone(input);
  if (typeof actor === 'string') actor = { key: actor };

  const hashFn = options.hashFn ?? withHash;
  const ajv = options.ajv ?? defaultAjv;

  const stepErrors = validateStep(ajv, process, action, actor, response);

  const event = hashFn(createEvent(process, action, actor, response, stepErrors));
  process.events.push(event);

  if (stepErrors.length > 0) {
    return process;
  }

  process.current.response = response;
  process.current.actor = process.actors[actor.key];

  const currentAction =
    process.scenario.actions[`${process.current.key}.${action}`] || process.scenario.actions[action];

  for (const scenarioInstructions of currentAction.update) {
    const instructions: InstantiatedUpdateInstructions = applyFn(scenarioInstructions, process);
    if (!instructions.if) continue;
    update(process, instructions.set, instructions.data, instructions.mode, actor.key);
  }

  const updateErrors = validateProcess(process, { ajv });

  const next: NormalizedTransition = process.scenario.states[process.current.key].transitions
    .filter((transition: NormalizedTransition) => 'on' in transition)
    .find((transition: NormalizedTransition): boolean => {
      const tr = applyFn(transition, process);
      return tr.if && tr.on === action && includesActor(tr.by, actor.key);
    });

  if (!next) {
    updateErrors.push(
      `No transition found for action '${action}' in state '${process.current.key}' for actor ${actor.key}`,
    );
  }

  if (updateErrors.length > 0) {
    const reverted = structuredClone(input);
    reverted.events.push(hashFn({ ...event, skipped: true, errors: updateErrors }));
    return reverted;
  }

  process.current = instantiateState(
    process.scenario,
    next.goto ?? process.current.key,
    process,
    next.goto ? event.timestamp : process.current.timestamp,
  );

  return process;
}

function createEvent(
  process: Process,
  action: string,
  actor: StepActor,
  response: any,
  errors: string[],
): Omit<ActionEvent, 'hash'> {
  return {
    previous: process.events[process.events.length - 1].hash,
    timestamp: new Date(),
    action,
    actor: actor.id ? { id: actor.id, key: actor.key } : { key: actor.key },
    response,
    skipped: errors.length > 0,
    errors: errors.length > 0 ? errors : undefined,
  }
}

function validateStep(ajv: Ajv, process: Process, action: string, actor: StepActor, response: any): string[] {
  const errors: string[] = [];

  const key = `${process.current.key}.${action}` in process.scenario.actions
    ? `${process.current.key}.${action}`
    : action;

  const currentAction = process.scenario.actions[key]
    ? instantiateAction(key, process.scenario.actions[key], process)
    : undefined;
  const service = actor.key.startsWith('service:') ? actor.key.split(':', 2)[1] : undefined;

  const transitions = process.scenario.states[process.current.key].transitions ?? [];
  if (!transitions.some((tr) => 'on' in tr && tr.on === action)) {
    errors.push(`Action '${action}' is not allowed in state '${process.current.key}'`);
  }

  if (!actor.key.startsWith('service:') && !process.actors[actor.key]) {
    errors.push(`Actor '${actor.key}' is not defined in the scenario`);
  }

  if (process.actors[actor.key] && (actor.id || actor.roles)) {
    const processActor = process.actors[actor.key];

    if (!processActor.id && !processActor.role) {
      errors.push(`Actor '${actor.key}' is not assigned to a user or role`);
    }

    if (processActor.id && processActor.id !== actor.id) {
      errors.push(`User is not allowed to perform as actor '${actor.key}'`);
    }

    if (!processActor.id && processActor.role) {
      const roles = typeof processActor.role === 'string' ? [processActor.role] : processActor.role;
      if (!actor.roles || !roles.some((role) => actor.roles!.includes(role))) {
        errors.push(`User is not allowed to perform as actor '${actor.key}'`);
      }
    }
  }

  if (
    process.actors[actor.key] &&
    currentAction &&
    !currentAction.actor.includes(actor.key) &&
    !currentAction.actor.includes(actor.key.replace(/\d+$/, '*')) &&
    !currentAction.actor.includes('*')
  ) {
    const actorDesc = actor.key.startsWith('service:') ? `Service '${service}'` : `Actor '${actor.key}'`;
    errors.push(`${actorDesc} is not allowed to perform action '${action}'`);
  }

  if (
    actor.key.startsWith('service:') &&
    !process.current.notify.some((notify) => notify.service === service && notify.trigger === action)
  ) {
    errors.push(`Service '${service}' is not expected to trigger action '${action}'`);
  }

  if (currentAction && !currentAction.if) {
    errors.push(`Action '${action}' is not allowed due to if condition`);
  }

  if (
    currentAction?.response &&
    Object.keys(currentAction.response).length > 0 &&
    !ajv.validate(currentAction.response, response)
  ) {
    errors.push(`Response is invalid: ${ajv.errorsText()}`);
  }

  return errors;
}

/**
 * Step the process forward in case of a timeout.
 * @return The updated process.
 */
export function timeout(input: Process, options: { hashFn?: typeof withHash } = {}): Process {
  const hashFn = options.hashFn ?? withHash;

  const process = structuredClone(input);
  const current = process.scenario.states[process.current.key];

  const timestamp = new Date();
  const timeout = timestamp.getTime() - process.current.timestamp.getTime();

  const next = (current.transitions ?? [])
    .filter((transition: NormalizedTransition) => 'after' in transition)
    .find((transition: NormalizedTransition) => {
      const tr: Transition & { after: number } = applyFn(transition, process);
      return tr.if && tr.after <= timeout;
    });

  if (!next) return process; // No timeout transition

  const event: TimeoutEvent = hashFn({
    previous: process.events[process.events.length - 1].hash,
    timestamp,
  });

  process.events.push(event);

  if (next.goto !== null) {
    process.current = instantiateState(process.scenario, next.goto, process, event.timestamp);
  }

  return process;
}

function update(
  process: Process,
  path: string,
  data: any,
  mode: 'replace' | 'merge' | 'append',
  currentActor: string,
): void {
  if (!path.match(/^title$|^(vars|actors|result|current\.actor)(\.|$)/)) {
    throw new Error(`Not allowed to set '${path}' through update instructions`);
  }

  if (mode === 'merge') {
    const current: any = get(process, path);

    if (Array.isArray(current) && Array.isArray(data)) {
      data = [...current, ...data];
    } else if (typeof current === 'object' && typeof data === 'object') {
      data = { ...current, ...data };
    }
  }

  if (mode === 'append') {
    const current: any = get(process, path);

    if (Array.isArray(current)) {
      data = [...current, data];
    } else {
      data = [data];
    }
  }

  set(process, path, data);

  if (path.match(/^current\.actor(\.|$)/) && currentActor in process.actors) {
    process.actors[currentActor] = process.current.actor!;
  }
}

function includesActor(actors: string[], key: string): boolean {
  return actors.includes(key) || actors.includes('*') || actors.includes(key.replace(/\d+$/, '*'));
}
