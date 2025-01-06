import { isFn } from '../process/fn';
import { actionSchema, scenarioSchema } from '../schemas/v1.0.0';
import {
  NormalizedExplicitTransition,
  NormalizedNotify,
  NormalizedScenario,
  NormalizedState,
  NormalizedTransition,
} from './interfaces/normalized';
import {
  Action,
  ActorSchema,
  EndState,
  ExplicitState,
  Notify,
  Scenario,
  Schema,
  State,
  Transition,
  UpdateInstruction,
} from './interfaces/scenario';
import { isEndState } from './validate';

function keyToTitle(key: string): string {
  return key.replace(/\*$/, '').replace('_', ' ').trim();
}

export function normalize<T extends Scenario>(scenario: T): NormalizedScenario {
  switch (scenario.$id ?? scenarioSchema.$id) {
    case scenarioSchema.$id:
      return normalizeScenario(scenario as Scenario);
    default:
      throw new Error(`Unsupported schema: ${scenario.$id}`);
  }
}

function normalizeScenario<T extends Scenario>(input: T): NormalizedScenario {
  const scenario = { $schema: scenarioSchema.$id, ...structuredClone(input) };

  scenario.title ??= '';
  scenario.description ??= '';
  scenario.tags ??= [];
  scenario.actors ??= { actor: { title: 'actor' } };
  scenario.actions ??= {};
  scenario.vars ??= {};

  normalizeActors(scenario.actors);
  normalizeActions(scenario.actions);
  normalizeStates(scenario.states);
  normalizeSchemas(scenario.vars, true);
  normalizeResult(scenario);

  addImplicitActions(scenario as NormalizedScenario);
  addImplicitEndStates(scenario.states as Record<string, State | EndState>);

  return scenario as NormalizedScenario;
}

function normalizeActors(items: Record<string, ActorSchema | null>): void {
  for (const key in items) {
    const actor = items[key] || {};

    actor.title ??= keyToTitle(key);
    actor.type ??= 'object';
    actor.properties = { ...(actor.properties ?? {}), id: { type: 'string' }, title: { type: 'string' } };

    normalizeSchemas(actor.properties);

    if (typeof actor.additionalProperties === 'object') {
      normalizeSchema(actor.additionalProperties);
    }

    items[key] = actor;
  }
}

function normalizeSchemas(schemas: Record<string, any>, setTitle = false): void {
  for (const key in schemas) {
    if (typeof schemas[key] === 'string') {
      schemas[key] = setTitle ? { title: keyToTitle(key), type: schemas[key] } : { type: schemas[key] };
      continue;
    }

    normalizeSchema(schemas[key]);
    if (setTitle) schemas[key].title ??= keyToTitle(key);
  }
}

function normalizeSchema(schema: Schema): void {
  schema.type ??= 'object';

  if (schema.properties) {
    normalizeSchemas(schema.properties);
  }

  if (typeof schema.items === 'string') {
    schema.items = { type: schema.items };
  } else if (typeof schema.items === 'object') {
    normalizeSchema(schema.items);
  }

  if (typeof schema.additionalProperties === 'string') {
    schema.additionalProperties = { type: schema.additionalProperties };
  } else if (typeof schema.additionalProperties === 'object') {
    normalizeSchema(schema.additionalProperties);
  }
}

function normalizeActions(actions: Record<string, Action | null>): void {
  for (const key in actions) {
    if (actions[key] === null) actions[key] = {};
    const action = actions[key] as Action;

    action.$schema ??= actionSchema.$id;

    action.title ??= keyToTitle(key);
    action.description ??= '';
    action.if ??= true;

    action.actor ??= ['*'];
    if (!Array.isArray(action.actor) && !isFn(action.actor)) {
      action.actor = [action.actor];
    }

    action.responseSchema ??= {};
    if (typeof action.responseSchema === 'string') {
      action.responseSchema = { $ref: action.responseSchema };
    }

    action.update = normalizeUpdateInstructions(action.update ?? []);
  }
}

function normalizeUpdateInstructions(
  instructions: string | UpdateInstruction | UpdateInstruction[],
): UpdateInstruction[] {
  if (typeof instructions === 'string') instructions = { set: instructions };

  return (Array.isArray(instructions) ? instructions : [instructions]).map((instruction) => ({
    set: instruction.set,
    data: instruction.data || { '<ref>': 'current.response' },
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
    state.notify = normalizeNotify(state.notify);

    if (!isEndState(state)) {
      state.transitions = normalizeTransitions(state);

      delete (state as any).on;
      delete (state as any).by;
      delete (state as any).after;
      delete (state as any).goto;
    }
  }

  if ('*' in states) {
    const anyState = states['*'] as NormalizedState;
    delete states['*'];

    Object.values(states as Record<string, NormalizedState>).forEach((state) => {
      mergeStates(state, anyState);
    });
  }
}

function normalizeNotify(notify?: string | Notify | Array<string | Notify>): NormalizedNotify[] {
  if (!notify) return [];

  if (!Array.isArray(notify)) {
    notify = [notify];
  }

  return notify
    .map((item) => (typeof item === 'string' ? { service: item } : item))
    .map((item): NormalizedNotify => {
      const { service, if: ifParam, after, ...rest } = item;
      return {
        service,
        after: typeof after === 'string' ? convertTimePeriodToSeconds(after) : after ?? 0,
        if: ifParam ?? true,
        ...rest,
      };
    });
}

function addImplicitActions(scenario: NormalizedScenario): void {
  const allActors = Object.keys(scenario.actors);

  const filterActors = (by: string[])=> [
    ...(by.includes('*') ? allActors : allActors.filter((actor) => by.includes(actor) || by.includes(actor.replace(/\d+$/, '*')))),
    ...by.filter((actor) => actor.startsWith('service:') && !allActors.includes(actor)),
  ];

  const actions = Object.entries(scenario.states)
    .filter(([, state]) => !isEndState(state))
    .map(([key, state]) => {
      const actions = state.transitions
        .filter((tr: NormalizedTransition): tr is NormalizedExplicitTransition => 'on' in tr)
        .map((tr: NormalizedExplicitTransition) => [tr.on, filterActors(tr.by)] as const)
        .filter(([action]: [string]) => !scenario.actions[action]);

      const map = new Map<string, string[]>();
      for (const [action, actors] of actions) {
        if (!map.has(action)) map.set(action, []);
        map.get(action)!.push(...actors);
      }

      return Array.from(map.entries()).map(([action, actors]) => [key, action, dedup(actors)] as const);
    })
    .flat();

  for (const [state, action, actors] of actions) {
    const key = `${state}.${action}`;

    if (scenario.actions[key]) {
      throw new Error(`Unable to create implicit action '${key}', because key is used for action in scenario`);
    }

    scenario.actions[key] = {
      $schema: actionSchema.$id,
      title: keyToTitle(action),
      description: '',
      if: true,
      actor: actors,
      responseSchema: {},
      update: [],
    };
  }
}

function addImplicitEndStates(states: Record<string, State | EndState>): void {
  const endStates = Object.values(states)
    .map((state) => ('transitions' in state ? state.transitions : []))
    .flat()
    .map((transition) => transition.goto)
    .filter((goto) => goto && goto.match(/^\(.+\)$/));

  for (const key of endStates) {
    states[key] ??= {
      title: keyToTitle(key.replace(/^\(|\)$/g, '')),
      description: '',
      instructions: {},
      notify: [],
    };
  }
}

function normalizeTransitions(state: State): Array<Transition> {
  if ('on' in state) {
    const by = Array.isArray(state.by) ? state.by : [state.by ?? '*'];
    return [{ on: state.on, by, if: true, goto: state.goto }];
  }

  if ('after' in state) {
    return [{ after: convertTimePeriodToSeconds(state.after), if: true, goto: state.goto }];
  }

  state.transitions.forEach((transition) => {
    if ('after' in transition && typeof transition.after === 'string') {
      transition.after = convertTimePeriodToSeconds(transition.after);
    }

    if ('on' in transition && !Array.isArray(transition.by)) {
      transition.by = [(transition.by ?? '*') as string];
    }

    transition.if ??= true;
  });

  return state.transitions;
}

function normalizeResult(scenario: Scenario): void {
  if (!scenario.result) {
    scenario.result ??= {};
    return;
  }

  if (typeof scenario.result === 'string') {
    scenario.result = { type: scenario.result };
    return;
  }

  normalizeSchema(scenario.result);
}

function mergeStates(state: NormalizedState, partialState: NormalizedState): void {
  const partial = structuredClone(partialState);

  if ('transitions' in state && 'transitions' in partial) {
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
