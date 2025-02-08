import { isFn } from '../process/fn';
import { actionSchema, scenarioSchema, schemaSchema } from '../schemas/v1.0';
import {
  NormalizedAction,
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

type InferReturnType<T> = T extends Scenario ? NormalizedScenario : Schema;

export function normalize(input: Scenario): NormalizedScenario;
export function normalize<T extends Scenario | Schema>(input: T, defaults: { $schema: string }): InferReturnType<T>;

export function normalize(input: Scenario | Schema, defaults?: { $schema: string }): NormalizedScenario | Schema {
  const ref = input.$schema ?? defaults?.$schema ?? scenarioSchema.$id;

  switch (ref) {
    case scenarioSchema.$id:
      return normalizeScenario(input as Scenario);
    case schemaSchema.$id:
      const schema: Schema = { $schema: schemaSchema.$schema, ...structuredClone(input) };
      return normalizeSchema(schema);
    case schemaSchema.$schema:
      return input as Schema;
    default:
      throw new Error(`Unsupported schema: ${ref}`);
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

function normalizeActors(items: Record<string, ActorSchema | string | null>): void {
  for (const key in items) {
    items[key] = typeof items[key] === 'string' ? stringToSchema(items[key]) : items[key] || {};
    normalizeActor(items[key] as ActorSchema, key);
  }
}

function normalizeActor(schema: ActorSchema, key?: string): ActorSchema {
  if (key) {
    schema.title ??= keyToTitle(key);
  }

  if ('$ref' in schema) {
    return schema;
  }

  schema.type ??= 'object';
  schema.properties = {
    ...(schema.properties ?? {}),
    id: 'string',
    title: 'string',
    role: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] },
  };

  return normalizeSchema(schema);
}

function normalizeSchemas(schemas: Record<string, any>, setTitle = false): { required: string[] } {
  const required: string[] = [];

  for (const key in schemas) {
    if (typeof schemas[key] === 'string') {
      schemas[key] = stringToSchema(schemas[key]);
      if (setTitle) schemas[key].title = keyToTitle(key);
      continue;
    }

    if (schemas[key]['!required']) {
      required.push(key);
    }

    normalizeSchema(schemas[key]);

    if (setTitle) schemas[key].title ??= keyToTitle(key);
  }

  return { required };
}

function normalizeListOfSchemas(schemas: Schema[]): Schema[] {
  return schemas.map((item: any) => {
    if (typeof item === 'string') {
      return { type: item };
    }

    normalizeSchema(item);
    return item;
  });
}

function normalizeSchema(schema: Schema): Schema {
  if ('allOf' in schema) schema.allOf = normalizeListOfSchemas(schema.allOf);
  if ('oneOf' in schema) schema.oneOf = normalizeListOfSchemas(schema.oneOf);
  if ('anyOf' in schema) schema.anyOf = normalizeListOfSchemas(schema.anyOf);

  if ('$ref' in schema || 'anyOf' in schema || 'oneOf' in schema || 'allOf' in schema) {
    return schema;
  }

  determineSchema(schema);

  if ('!required' in schema) {
    delete schema['!required'];
  }

  if (schema.properties) {
    const { required } = normalizeSchemas(schema.properties);

    if (required.length > 0) {
      schema.required = dedup([...(schema.required ?? []), ...required]);
    }
  }

  if (schema.definitions) normalizeSchemas(schema.definitions);
  if (schema.$defs) normalizeSchemas(schema.$defs);

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

  if (typeof schema.patternProperties === 'object') {
    for (const key in schema.patternProperties) {
      if (typeof schema.patternProperties[key] === 'string') {
        schema.patternProperties[key] = stringToSchema(schema.patternProperties[key]);
      } else if (typeof schema.patternProperties[key] === 'object') {
        normalizeSchema(schema.patternProperties[key]);
      }
    }
  }

  if (schema.type === 'object') {
    schema.additionalProperties ??= false;
  }

  return schema;
}

function normalizeActions(actions: Record<string, Action | null>): void {
  for (const key in actions) {
    if (actions[key] === null) actions[key] = {};
    normalizeAction(actions[key] as Action, key);
  }
}

function normalizeAction(action: Action, key?: string): NormalizedAction {
  action.$schema ??= actionSchema.$id;

  if (key) {
    action.title ??= keyToTitle(key);
  }

  action.description ??= '';
  action.if ??= true;

  action.actor ??= ['*'];
  if (!Array.isArray(action.actor) && !isFn(action.actor)) {
    action.actor = [action.actor];
  }

  action.response ??= {};
  if (typeof action.response === 'string') {
    action.response = stringToSchema(action.response);
  }
  if (typeof action.response === 'object' && Object.keys(action.response).length > 0 && !isFn(action.response)) {
    normalizeSchema(action.response);
  }

  action.update = normalizeUpdateInstructions(action.update ?? []);

  return action as NormalizedAction;
}

function normalizeUpdateInstructions(
  instructions: string | UpdateInstruction | UpdateInstruction[],
): UpdateInstruction[] {
  if (typeof instructions === 'string') {
    instructions = { set: instructions };
  }

  return (Array.isArray(instructions) ? instructions : [instructions]).map((instruction) => ({
    set: instruction.set,
    value: instruction.value ?? { '<ref>': 'current.response' },
    stub: instruction.stub ?? undefined,
    mode: instruction.mode ?? 'replace',
    if: instruction.if ?? true,
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
      state.transitions = normalizeTransitions(key, state);

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

  const filterActors = (by: string[]) => [
    ...(by.includes('*')
      ? allActors
      : allActors.filter((actor) => by.includes(actor) || by.includes(actor.replace(/\d+$/, '*')))),
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
      response: {},
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

function normalizeTransitions(key: string, state: State): Array<Transition> {
  if ('on' in state) {
    const by = Array.isArray(state.by) ? state.by : [state.by ?? '*'];
    return [{ on: state.on, by, if: true, goto: state.goto }];
  }

  if ('after' in state) {
    return [{ after: convertTimePeriodToSeconds(state.after), if: true, goto: state.goto }];
  }

  if ('goto' in state) {
    throw new Error(`Invalid state '${key}': 'goto' without 'on' or 'after'`);
  }

  for (const transition of state.transitions) {
    if ('after' in transition && typeof transition.after === 'string') {
      transition.after = convertTimePeriodToSeconds(transition.after);
    }

    if ('on' in transition && !Array.isArray(transition.by)) {
      transition.by = [(transition.by ?? '*') as string];
    }

    transition.if ??= true;
  }

  return state.transitions;
}

function normalizeResult(scenario: Scenario): void {
  if (!scenario.result) {
    scenario.result ??= {};
    return;
  }

  if (typeof scenario.result === 'string') {
    scenario.result = stringToSchema(scenario.result);
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

function stringToSchema(schema: string): Schema {
  return schema.match(/^https?:|^#/) ? { $ref: schema } : { type: schema };
}

function convertTimePeriodToSeconds(timePeriod: string | number): number {
  if (typeof timePeriod === 'number') return timePeriod;

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

function determineSchema(schema: Schema): void {
  if (schema.type || '$ref' in schema) return;

  if ('const' in schema) {
    schema.type = typeof schema.const;
    return;
  }

  if ('enum' in schema) {
    const types = dedup<string>(schema.enum.map((item: any) => typeof item));
    schema.type = types.length === 1 ? types[0] : types;
  }

  if ('items' in schema) {
    schema.type = 'array';
    return;
  }

  if ('properties' in schema || 'patternProperties' in schema || 'additionalProperties' in schema) {
    schema.type = 'object';
    return;
  }
}

function keyToTitle(key: string): string {
  return key.replace(/\*$/, '').replace('_', ' ').trim();
}

function dedup<T>(array: Array<T>): Array<T> {
  return Array.from(new Set(array));
}
