import * as Input from './interfaces/scenario-input';
import * as Output from './interfaces/scenario';

const scenarioJsonSchema = 'https://specs.letsflow.io/v0.3.0/scenario#';
const actorJsonSchema = 'https://specs.letsflow.io/v0.3.0/actor#';
const actionJsonSchema = 'https://specs.letsflow.io/v0.3.0/action#';

export function normalize(input: Input.Scenario): Output.Scenario {
  if (input.$schema && input.$schema !== scenarioJsonSchema) {
    throw new Error(`Unsupported scenario schema: ${input.$schema}, only ${scenarioJsonSchema} is supported`);
  }

  const actors = Object.keys(input.actors);

  return {
    title: input.title,
    description: input.description,
    actors: normalizeActors(input.actors),
    actions: normalizeActions(input.actions, actors),
    states: normalizeStates(input.states),
    data: input.data || {},
  };
}

function normalizeActors(actors: Record<string, Input.Actor>): Output.Actor[] {
  return Object.entries(actors).map(([key, actor]) => ({
    schema: actor.$schema || actorJsonSchema,
    key,
    title: actor.title || key,
  }));
}

function normalizeActions(actions: Record<string, Input.Action>, allActors: string[]): Output.Action[] {
  return Object.entries(actions).map(([key, action]) => ({
    schema: action.$schema || actionJsonSchema,
    key,
    title: action.title || key,
    description: action.description,
    actors: action.actor || allActors,
    responses: normalizeResponses(action.responses),
  }));
}

function normalizeResponses(responses?: Record<string, Input.Response>): Output.Response[] {
  if (!responses) {
    return [{ key: 'ok', title: 'ok', update: [] }];
  }

  return Object.entries(responses).map(([key, response]) => ({
    key,
    title: response.title || key,
    update: normalizeUpdateInstructions(response.update || []),
  }));
}

function normalizeUpdateInstructions(
  instructions: Input.UpdateInstruction | Input.UpdateInstruction[],
): Output.UpdateInstruction[] {
  return (Array.isArray(instructions) ? instructions : [instructions]).map((instruction) => ({
    select: instruction.select,
    data: instruction.data,
    patch: instruction.patch || false,
    projection: instruction.apply,
    condition: instruction.if || true,
  }));
}

function normalizeStates(states: Record<string, Input.State | Input.SimpleState>): Output.State[] {
  return Object.entries(states).map(([key, state]) => ({
    key,
    title: state.title || key,
    description: state.description,
    actions: normalizeStateActions(state),
    transitions: normalizeStateTransitions(state),
  }));
}

function normalizeStateActions(state: Input.State | Input.SimpleState): string[] {
  return ('on' in state ? [state.on] : state.transitions.map((transition) => transition.on))
    .map((action) => action.split('.')[0]);
}

function normalizeStateTransitions(state: Input.State | Input.SimpleState): Output.Transition[] {
  if ('on' in state) {
    const [action, response] = state.on.split('.');
    return [{ action, response, condition: true, target: state.goto }];
  }

  return state.transitions.map((transition) => {
    const [action, response] = transition.on.split('.');
    return { action, response, condition: transition.if || true, target: transition.goto };
  });
}
