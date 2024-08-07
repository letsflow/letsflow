import {
  Action,
  Scenario,
  UpdateInstruction,
  State,
  Transition,
  Schema,
  EndState,
  ExplicitState,
} from './interfaces/scenario';
import { NormalizedScenario, NormalizedState } from './interfaces/normalized';
import { actionJsonSchema, scenarioJsonSchema } from '../constants';
import { isFn } from '../process/fn';
import { isEndState } from './validate';

function keyToTitle(key: string): string {
  return key.replace(/\*$/, '').replace('_', ' ').trim();
}

export function normalize<T extends Scenario>(input: T): NormalizedScenario {
  const scenario = structuredClone(input);

  scenario.$schema ??= scenarioJsonSchema;
  if (scenario.$schema !== scenarioJsonSchema) {
    throw new Error(`Unsupported scenario schema: ${scenario.$schema}, only ${scenarioJsonSchema} is supported`);
  }

  scenario.description ??= '';
  scenario.tags ??= [];
  scenario.actors ??= { actor: { title: 'actor' } };
  scenario.vars ??= {};

  normalizeActors(scenario.actors);
  normalizeActions(scenario.actions, Object.keys(scenario.actors));
  normalizeStates(scenario.states);
  addImplicitEndStates(scenario.states as Record<string, State | EndState>);
  normalizeSchemas(scenario.vars, true);

  return scenario as NormalizedScenario;
}

function normalizeActors(items: Record<string, Schema | null>): void {
  for (const key in items) {
    const actor = items[key] || {};

    actor.title ??= keyToTitle(key);
    actor.type ??= 'object';
    actor.properties = { ...(actor.properties ?? {}), id: { type: 'string' }, title: { type: 'string' } };

    normalizeSchemas(actor.properties);

    items[key] = actor;
  }
}

function normalizeSchemas(schemas: Record<string, any>, setTitle = false): void {
  for (const key in schemas) {
    if (typeof schemas[key] === 'string') {
      schemas[key] = setTitle ? { title: keyToTitle(key), type: schemas[key] } : { type: schemas[key] };
      continue;
    }

    schemas[key].type ??= 'object';
    if (setTitle) schemas[key].title ??= keyToTitle(key);

    if ('properties' in schemas[key]) {
      normalizeSchemas(schemas[key].properties);
    }

    if ('additionalProperties' in schemas[key]) {
      schemas[key].type ??= 'object';
      normalizeSchemas(schemas[key].properties);
    }
  }
}

function normalizeActions(actions: Record<string, Action | null>, allActors: string[]): void {
  for (const key in actions) {
    if (actions[key] === null) actions[key] = {};
    const action = actions[key] as Action;

    action.$schema ??= actionJsonSchema;

    action.title ??= keyToTitle(key);
    action.description ??= '';

    action.actor ??= allActors;
    if (!Array.isArray(action.actor) && !isFn(action.actor)) action.actor = [action.actor];

    action.responseSchema ??= {};
    if (typeof action.responseSchema === 'string') action.responseSchema = { $ref: action.responseSchema };

    action.update = normalizeUpdateInstructions(action.update ?? []);
  }
}

function normalizeUpdateInstructions(
  instructions: string | UpdateInstruction | UpdateInstruction[],
): UpdateInstruction[] {
  if (typeof instructions === 'string') instructions = { path: instructions };

  return (Array.isArray(instructions) ? instructions : [instructions]).map((instruction) => ({
    path: instruction.path,
    data: instruction.data || { '<ref>': 'response' },
    merge: instruction.merge || false,
    if: instruction.if || true,
  }));
}

function normalizeStates(states: Record<string, State | EndState | null>): void {
  for (const key in states) {
    const state = (states[key] || {}) as ExplicitState | EndState;

    state.title ??= keyToTitle(key);
    state.description ??= '';
    state.instructions ??= {};
    state.notify ??= [];

    if (!isEndState(state)) {
      state.actions ??= determineActions(state);
      state.transitions = normalizeTransitions(state);
    }

    delete (state as any).on;
    delete (state as any).after;
    delete (state as any).goto;
  }

  if ('*' in states) {
    const anyState = states['*'] as NormalizedState;
    delete states['*'];

    Object.values(states as Record<string, NormalizedState>).forEach((state) => {
      mergeStates(state, anyState);
    });
  }
}

function addImplicitEndStates(states: Record<string, State | EndState>): void {
  const endStates = Object.values(states)
    .map((state) => ('transitions' in state ? state.transitions : []))
    .flat()
    .map((transition) => transition.goto)
    .filter((goto) => goto.match(/^\(.+\)$/));

  for (const key of endStates) {
    states[key] ??= {
      title: keyToTitle(key.replace(/^\(|\)$/g, '')),
      description: '',
      instructions: {},
      notify: [],
    };
  }
}

function determineActions(state: State): string[] {
  if ('after' in state) return [];
  if ('on' in state) return [state.on];

  return state.transitions.filter((transition) => 'on' in transition).map((transition) => (transition as any).on);
}

function normalizeTransitions(state: State): Array<Transition> {
  if ('on' in state) {
    return [{ on: state.on, if: true, goto: state.goto }];
  }

  if ('after' in state) {
    return [{ after: state.after, if: true, goto: state.goto }];
  }

  state.transitions.forEach((transition) => {
    if ('after' in transition && typeof transition.after === 'string') {
      transition.after = convertTimePeriodToSeconds(transition.after);
    }

    transition.if ??= true;
  });

  return state.transitions;
}

function mergeStates(state: NormalizedState, partialState: NormalizedState): void {
  const partial = structuredClone(partialState);

  if ('transitions' in state && 'transitions' in partial) {
    state.actions = dedup([...state.actions, ...partial.actions]);
    state.transitions.push(...partial.transitions);
  }

  state.instructions = { ...partial.instructions, ...state.instructions };
  state.notify.push(...partial.notify);

  for (const key in partial) {
    if (partial.hasOwnProperty(key) && !state.hasOwnProperty(key)) {
      state[key] = partial[key];
    }
  }
}

function convertTimePeriodToSeconds(timePeriod: string): number {
  const match = timePeriod.match(/^\s*(\d+)\s*(\w*)\s*$/);
  if (!match) throw new Error('Invalid time period format');

  const value = parseInt(match[1]);
  if (isNaN(value)) throw new Error('Invalid time period value');

  const unit = match[2]?.toLowerCase();

  switch (unit) {
    case '':
    case 's':
    case 'second':
    case 'seconds':
      return value;
    case 'm':
    case 'minute':
    case 'minutes':
      return value * 60;
    case 'h':
    case 'hour':
    case 'hours':
      return value * 3600;
    case 'd':
    case 'day':
    case 'days':
      return value * 86400;
    case 'w':
    case 'week':
    case 'weeks':
      return value * 604800;
    default:
      throw new Error('Invalid time period unit.');
  }
}

function dedup<T>(array: Array<T>): Array<T> {
  return Array.from(new Set(array));
}
