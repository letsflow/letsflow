import {
  Action,
  Scenario,
  UpdateInstruction,
  State,
  Transition,
  JsonObjectSchema, EndState,
} from './interfaces/scenario';
import { actionJsonSchema, scenarioJsonSchema } from './constants';

function keyToTitle(key: string): string {
  return key.replace('_', ' ');
}

export function normalize(input: Scenario): Scenario {
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

  return scenario;
}

function normalizeActors(actors: Record<string, JsonObjectSchema>): void {
  Object.entries(actors).forEach(([key, actor]) => {
    actor.title ??= keyToTitle(key);
    actor.properties ??= {};
    actor.properties.title = { type: 'string' };
  });
}

function normalizeActions(actions: Record<string, Action>, allActors: string[]): void {
  Object.entries(actions).forEach(([key, action]) => {
    action.$schema ??= actionJsonSchema;
    action.title ??= keyToTitle(key);
    action.actor ??= allActors;
    action.description ??= '';
    action.$schema ??= actionJsonSchema;
    action.update ??= [];

    normalizeUpdateInstructions(action.update);
  });
}


function normalizeUpdateInstructions(
  instructions: UpdateInstruction | UpdateInstruction[],
): UpdateInstruction[] {
  return (Array.isArray(instructions) ? instructions : [instructions]).map((instruction) => ({
    select: instruction.select,
    data: instruction.data || { '<ref>': 'response' },
    patch: instruction.patch || false,
    if: instruction.if || true,
  }));
}

function normalizeStates(states: Record<string, State | EndState>): void {
  for (const key in states) {
    const state = states[key];
    states[key] = 'goto' in state || 'transitions' in state ? {
      title: state.title ?? keyToTitle(key),
      description: state.description ?? '',
      instructions: state.instructions ?? {},
      actions: state.actions ?? determineActions(state),
      transitions: normalizeTransitions(state),
    } : {
      title: state.title ?? keyToTitle(key),
      description: state.description ?? '',
    };
  }
}

function determineActions(state: State): string[] {
  if ('after' in state) return [];
  if ('on' in state) return [state.on];

  return state.transitions
    .filter((transition) => 'on' in transition)
    .map((transition) => (transition as any).on);
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
  const match = timePeriod.trim().match(/^(\d+)(\w*)$/);

  if (!match) {
    throw new Error('Invalid time period format.');
  }

  const value = parseInt(match[1]);

  if (isNaN(value)) {
    throw new Error('Invalid time period value.');
  }

  const unit = match[2]?.toLowerCase();

  switch (unit) {
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
