import Ajv, { Ajv2020 } from 'ajv/dist/2020';
import get from 'get-value';
import set from 'set-value';
import { ajv as defaultAjv } from '../ajv';
import { NormalizedExplicitTransition, NormalizedTransition, Transition } from '../scenario';
import { applyFn } from './fn';
import { withHash } from './hash';
import { defaultValue, instantiateAction, instantiateActor, instantiateState } from './instantiate';
import { ActionEvent, HashFn, Index, TimeoutEvent } from './interfaces';
import { clean } from './utils';
import { validateProcess } from './validate';

export interface InstantiatedUpdateInstructions {
  set: string;
  value: any;
  stub: any;
  mode: 'replace' | 'merge' | 'append';
  if: boolean;
}

interface StepActor {
  key: string;
  id?: string;
  roles?: string[];
  [_: string]: any;
}

/**
 * Step the process forward by one action.
 * @return The updated process.
 */
export function step<T extends Index>(
  input: T,
  action: string,
  actor: StepActor | string = 'actor',
  response?: any,
  options: {
    hashFn?: HashFn;
    ajv?: Ajv;
  } = {},
): T {
  const process = structuredClone(input);
  if (typeof actor === 'string') actor = { key: actor };

  const hashFn: HashFn = options.hashFn ?? withHash;
  const ajv = options.ajv ?? defaultAjv;

  const currentAction =
    process.scenario.actions[`${process.current.key}.${action}`] || process.scenario.actions[action];

  const event = hashFn(createEvent(process, action, actor, response));
  process.events.push(event);

  response ??= currentAction?.response ? defaultValue(currentAction.response, { ajv }) : undefined;

  process.current.response = response;
  process.current.actor = process.actors[actor.key];

  const stepErrors = validateStep(process, action, actor, response, { ajv });

  if (stepErrors.length > 0) {
    const reverted = structuredClone(input);
    reverted.events.push(hashFn<ActionEvent>({ ...event, skipped: true, errors: stepErrors }));
    return reverted;
  }

  for (const scenarioInstructions of currentAction.update) {
    const instructions: InstantiatedUpdateInstructions = applyFn(scenarioInstructions, process);
    if (!instructions.if) continue;

    update(process, instructions, actor.key, { ajv });
  }

  const updateErrors = !isPrediction(process) ? validateProcess(process, { ajv }) : [];

  const next = findActionTransition(process, action, actor.key);
  if (!next) {
    updateErrors.push(
      `No transition found for action '${action}' in state '${process.current.key}' for actor ${actor.key}`,
    );
  }

  if (updateErrors.length > 0) {
    const reverted = structuredClone(input);
    reverted.events.push(hashFn<ActionEvent>({ ...event, skipped: true, errors: updateErrors }));
    return reverted;
  }

  process.current = instantiateState(
    process,
    next!.goto ?? process.current.key,
    next!.goto ? event.timestamp : process.current.timestamp,
  );

  return process;
}

export function findActionTransition(
  process: Index,
  action: string,
  actor: string,
): NormalizedExplicitTransition | undefined {
  return process.scenario.states[process.current.key].transitions
    .filter((transition: NormalizedTransition) => 'on' in transition)
    .find((transition: NormalizedTransition): boolean => {
      const tr = applyFn(transition, process);
      return tr.if && tr.on === action && includesActor(tr.by, actor);
    });
}

function createEvent(
  process: Index,
  action: string,
  actor: StepActor,
  response: any,
  errors: string[] = [],
): Omit<ActionEvent, 'hash'> {
  return {
    previous: process.events[process.events.length - 1].hash,
    timestamp: new Date(),
    action,
    actor: clean({ ...actor, roles: undefined }),
    response,
    skipped: errors.length > 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export function validateStep(
  process: Index,
  action: string,
  actor: StepActor,
  response: any,
  options: { ajv?: Ajv2020 } = {},
): string[] {
  const errors: string[] = [];

  const key =
    `${process.current.key}.${action}` in process.scenario.actions ? `${process.current.key}.${action}` : action;

  const currentAction = process.scenario.actions[key]
    ? instantiateAction(process, key, process.scenario.actions[key])
    : undefined;
  const service = actor.key.startsWith('service:') ? actor.key.split(':', 2)[1] : undefined;

  const transitions: Transition[] = process.scenario.states[process.current.key].transitions ?? [];
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

  if (process.actors[actor.key] && currentAction && !currentAction.actor.includes(actor.key)) {
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

  const ajv = options.ajv ?? defaultAjv;

  if (
    !isPrediction(process) &&
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
export function timeout<T extends Index>(input: T, options: { hashFn?: HashFn; timePassed?: number } = {}): T {
  const hashFn: HashFn = options.hashFn ?? withHash;

  const process = structuredClone(input);

  const timestamp = new Date();
  const timePassed = options.timePassed ?? timestamp.getTime() - process.current.timestamp.getTime();

  const event: TimeoutEvent = hashFn({
    previous: process.events[process.events.length - 1].hash,
    timestamp,
  });

  process.events.push(event);

  const next = findTimeoutTransition(process, timePassed);
  if (!next) return input; // No timeout transition

  if (next.goto !== null) {
    process.current = instantiateState(process, next.goto, event.timestamp);
  }

  return process;
}

export function findTimeoutTransition(process: Index, timePassed: number): NormalizedTransition | undefined {
  const current = process.scenario.states[process.current.key];

  return (current.transitions ?? [])
    .filter((transition: NormalizedTransition) => 'after' in transition)
    .find((transition: NormalizedTransition) => {
      const tr: Transition & { after: number } = applyFn(transition, process);
      return tr.if && tr.after <= timePassed;
    });
}

export function update(
  process: Index,
  instructions: InstantiatedUpdateInstructions,
  currentActor: string,
  options: { ajv?: Ajv } = {},
): void {
  const path = instructions.set;
  let value = isPrediction(process) && instructions.stub !== null ? instructions.stub : instructions.value;
  const mode = instructions.mode ?? 'replace';

  if (!path.match(/^title$|^(vars|actors|result|current\.actor)(\.|$)/)) {
    throw new Error(`Not allowed to set '${path}' through update instructions`);
  }

  const exitingActors = Object.keys(process.actors);

  if (mode === 'merge') {
    const current: any = get(process, path);

    if (Array.isArray(current) && Array.isArray(value)) {
      value = [...current, ...value];
    } else if (typeof current === 'object' && typeof value === 'object') {
      value = { ...current, ...value };
    }
  }

  if (mode === 'append') {
    const current: any = get(process, path);

    if (Array.isArray(current)) {
      value = [...current, value];
    } else {
      value = [value];
    }
  }

  set(process, path, value);

  if (path.match(/^current\.actor(\.|$)/) && currentActor in process.actors) {
    process.actors[currentActor] = process.current.actor!;
  }

  const addedActors = Object.keys(process.actors).filter((key) => !exitingActors.includes(key));
  for (const actor of addedActors) {
    try {
      process.actors[actor] = instantiateActor(process.scenario.actors, actor, process.actors[actor], options);
    } catch (error) {
      // Will fail at validation, so no need to do anything
      void error;
    }
  }
}

function includesActor(actors: string[], key: string): boolean {
  return actors.includes(key) || actors.includes('*') || actors.includes(key.replace(/\d+$/, '*'));
}

function isPrediction(process: Index): boolean {
  return 'is_prediction' in process && (process.is_prediction as boolean);
}
