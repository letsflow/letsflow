import {
  Action,
  Scenario,
  UpdateInstruction,
  State,
  Transition,
  Schema,
  EndState,
  NormalizedScenario,
} from './interfaces/scenario';
import { actionJsonSchema, scenarioJsonSchema } from './constants';

function keyToTitle(key: string): string {
  return key.replace('_', ' ');
}

export function normalize(input: Scenario): NormalizedScenario {
  const scenario: Scenario = structuredClone(input);

  scenario.$schema ??= scenarioJsonSchema;
  if (scenario.$schema !== scenarioJsonSchema) {
    throw new Error(`Unsupported scenario schema: ${scenario.$schema}, only ${scenarioJsonSchema} is supported`);
  }

  scenario.description ??= '';
  scenario.actors ??= { actor: { title: 'actor' } };
  scenario.assets ??= {};

  normalizeActors(scenario.actors);
  normalizeActions(scenario.actions, Object.keys(scenario.actors));
  normalizeStates(scenario.states);
  normalizeSchemas(scenario.assets, true);

  return scenario as NormalizedScenario;
}

function normalizeActors(items: Record<string, Schema | null>): void {
  for (const key in items) {
    const actor = items[key] || {};

    actor.title ??= keyToTitle(key);
    actor.type ??= 'object';
    actor.properties = { ...(actor.properties ?? {}), title: { type: 'string' } };

    normalizeSchemas(actor.properties);

    items[key] = actor;
  }
}

function normalizeSchemas(properties: Record<string, any>, setTitle = false): void {
  for (const key in properties) {
    if (typeof properties[key] === 'string') {
      properties[key] = setTitle ? { title: keyToTitle(key), type: properties[key] } : { type: properties[key] };
      continue;
    }

    properties[key].type ??= 'object';
    if (setTitle) properties[key].title ??= keyToTitle(key);

    if ('properties' in properties[key]) {
      normalizeSchemas(properties[key].properties);
    }

    if ('additionalProperties' in properties[key]) {
      properties[key].type ??= 'object';
      normalizeSchemas(properties[key].properties);
    }
  }
}

function normalizeActions(actions: Record<string, Action | null>, allActors: string[]): void {
  for (const key in actions) {
    if (actions[key] === null) actions[key] = {};
    const action = actions[key] as Action;

    action.$schema ??= actionJsonSchema;
    action.title ??= keyToTitle(key);
    action.actor ??= allActors;
    action.description ??= '';
    action.$schema ??= actionJsonSchema;
    action.update = normalizeUpdateInstructions(action.update ?? []);
  }
}

function normalizeUpdateInstructions(instructions: UpdateInstruction | UpdateInstruction[]): UpdateInstruction[] {
  return (Array.isArray(instructions) ? instructions : [instructions]).map((instruction) => ({
    select: instruction.select,
    data: instruction.data || { '<ref>': 'response' },
    patch: instruction.patch || false,
    if: instruction.if || true,
  }));
}

function normalizeStates(states: Record<string, State | EndState | null>): void {
  for (const key in states) {
    const state = (states[key] || {}) as State | EndState;

    states[key] =
      'goto' in state || 'transitions' in state
        ? {
            title: state.title ?? keyToTitle(key),
            description: state.description ?? '',
            instructions: state.instructions ?? {},
            actions: state.actions ?? determineActions(state),
            transitions: normalizeTransitions(state),
          }
        : {
            title: state.title ?? keyToTitle(key),
            description: state.description ?? '',
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
