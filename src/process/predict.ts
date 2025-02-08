import Ajv from 'ajv/dist/2020';
import { isEndState, NormalizedExplicitTransition, NormalizedTransition } from '../scenario';
import { hash, withHash } from './hash';
import { ActionEvent, PredictedState, Process, State } from './interfaces/process';
import { step, timeout } from './step';

type HashFn = typeof withHash;

export function predict(input: Process, options: { ajv?: Ajv; max?: number } = {}): PredictedState[] {
  const { ajv } = options;
  const hashFn = <T extends Record<string, any>>(data: T): T & { hash: string } => ({ ...data, hash: '' });
  const max = options.max ?? 100;

  let process = { ...input, is_prediction: true };
  const seen = new Set<string>();
  const next: PredictedState[] = [];

  while (!seen.has(hashProcess(process))) {
    next.push(asPredictedState(process.current));
    seen.add(hashProcess(process));

    process = tryToStep(process, { ajv, hashFn });

    if (next.length > max) {
      throw new Error('Max iterations reached');
    }
  }

  if (!isEndState(process.scenario.states[process.current.key]) && next[next.length - 1].key !== process.current.key) {
    next.push(asPredictedState(process.current));
  }

  return next;
}

function tryToStep<T extends Process>(process: T, options: { ajv?: Ajv; hashFn?: HashFn } = {}): T {
  const state = process.scenario.states[process.current.key];
  if (isEndState(state)) {
    return process;
  }

  const transitions: NormalizedExplicitTransition[] = state.transitions.filter(
    (tr: NormalizedTransition) => 'on' in tr && tr.on !== null,
  );

  // No transitions, try timeout
  if (transitions.length === 0) {
    return timeout(process, { ...options, force: true });
  }

  const tried = new Set<string>();

  // Try every combination of actions and actors until one succeeds
  for (const transition of transitions) {
    const action = transition.on;
    let actors = transition.by ?? process.current.actions.find((a) => a.key === action)?.actor ?? [];

    if (actors.includes('*')) {
      actors = Object.keys(process.actors);
    }

    for (const actor of actors) {
      if (tried.has(`${action}.${actor}`)) {
        continue;
      }

      const stepped = step(process, action, actor, undefined, options);
      if (!(stepped.events[stepped.events.length - 1] as ActionEvent).skipped) {
        return stepped;
      }

      tried.add(`${action}.${actor}`);
    }
  }

  // Failed to step
  return process;
}

function asPredictedState(state: State): PredictedState {
  const { timestamp: _, notify: __, ...rest } = state;
  return rest;
}

// Hash the state of the process; everything that is variable
function hashProcess(process: Process) {
  const { title, tags, actors, vars, result, current } = process;

  return hash({
    title,
    tags,
    actors,
    vars,
    result,
    current: current.key,
  });
}
