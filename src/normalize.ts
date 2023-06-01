import {
  Action,
  Scenario,
  Response,
  UpdateInstruction,
  State,
  SimpleState,
  Transition,
  JsonObjectSchema
} from "./interfaces/scenario";

const scenarioJsonSchema = 'https://specs.letsflow.io/v0.3.0/scenario';
const actionJsonSchema = 'https://specs.letsflow.io/v0.3.0/action';

export function normalize(input: Scenario): Scenario {
  const scenario = structuredClone(input);

  if (scenario.$schema && scenario.$schema !== scenarioJsonSchema) {
    throw new Error(`Unsupported scenario schema: ${scenario.$schema}, only ${scenarioJsonSchema} is supported`);
  }

  scenario.description ??= '';
  normalizeActors(scenario.actors);
  normalizeActions(scenario.actions, Object.keys(scenario.actors));
  normalizeStates(scenario.states);
  scenario.assets ??= {};

  return scenario;
}

function normalizeActors(actors: Record<string, JsonObjectSchema>): void {
  Object.entries(actors).forEach(([key, actor]) => {
    actor.title ??= key;
    actor.properties ??= {};
    actor.properties.title = { type: 'string' };
  });
}

function normalizeActions(actions: Record<string, Action>, allActors: string[]): void {
  Object.entries(actions).forEach(([key, action]) => {
    action.$schema ??= actionJsonSchema;
    action.title ??= key;
    action.actor ??= allActors;
    action.description ??= '';
    action.responses ??= { ok: { title: 'ok', update: [] } };
    action.$schema ??= actionJsonSchema;

    normalizeResponses(action.responses);
  });
}

function normalizeResponses(responses: Record<string, Response>): void {
  Object.entries(responses).forEach(([key, response]) => {
    response.title ??= key;
    response.update = normalizeUpdateInstructions(response.update ?? []);
  });
}

function normalizeUpdateInstructions(
  instructions: UpdateInstruction | UpdateInstruction[],
): UpdateInstruction[] {
  return (Array.isArray(instructions) ? instructions : [instructions]).map((instruction) => ({
    select: instruction.select,
    data: instruction.data || { '<ref>': 'response' },
    patch: instruction.patch || false,
    apply: instruction.apply,
    if: instruction.if || true,
  }));
}

function normalizeStates(states: Record<string, State | SimpleState>): void {
  for (const key in states) {
    const state = states[key];
    states[key] = {
      title: state.title ?? key,
      instructions: typeof state.instructions === 'string' ? { '*': state.instructions } : state.instructions ?? {},
      actions: normalizeStateActions(state),
      transitions: normalizeTransitions(state),
    }
  }
}

function normalizeStateActions(state: State | SimpleState): string[] {
  return ('on' in state ? [state.on] : state.transitions.map((transition) => transition.on))
    .filter((on) => !!on)
    .map((on) => typeof on === 'string' ? on.split('.')[0] : on!.action);
}

function normalizeTransitions(state: State | SimpleState): Transition[] {
  if ('on' in state) {
    const [action, response] = typeof state.on === 'string'
        ? state.on.split('.')
        : [state.on.action, state.on.response || '*'];
    return [{ on: { action, response }, if: true, goto: state.goto }];
  }

  state.transitions.forEach((transition) => {
    if (typeof transition.on === 'string') {
      const [action, response] = transition.on.split('.');
      transition.on = { action, response };
    }

    transition.if ??= true;
  });

  return state.transitions;
}
