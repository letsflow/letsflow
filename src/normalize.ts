import {
    Action,
    Scenario,
    UpdateInstruction,
    State,
    SimpleState,
    Transition,
    JsonObjectSchema, TimeoutTransition
} from "./interfaces/scenario";

const scenarioJsonSchema = 'https://specs.letsflow.io/v0.3.0/scenario';
const actionJsonSchema = 'https://specs.letsflow.io/v0.3.0/action';

function keyToTitle(key: string): string {
    return key.replace(/[\-_]/, ' ');
}

export function normalize(input: Scenario): Scenario {
    const scenario = structuredClone(input);

    if (scenario.$schema && scenario.$schema !== scenarioJsonSchema) {
        throw new Error(`Unsupported scenario schema: ${scenario.$schema}, only ${scenarioJsonSchema} is supported`);
    }

    scenario.description ??= '';
    scenario.actors ??= {actor: {title: 'actor'}};
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
        actor.properties.title = {type: 'string'};
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
        data: instruction.data || {'<ref>': 'response'},
        patch: instruction.patch || false,
        if: instruction.if || true,
    }));
}

function normalizeStates(states: Record<string, State | SimpleState>): void {
    for (const key in states) {
        const state = states[key];
        states[key] = {
            title: state.title ?? keyToTitle(key),
            instructions: typeof state.instructions === 'string' ? {'*': state.instructions} : state.instructions ?? {},
            transitions: normalizeTransitions(state),
        };
    }
}

function normalizeTransitions(state: State | SimpleState): Array<Transition | TimeoutTransition> {
    if ('on' in state) {
        return [{on: state.on, if: true, goto: state.goto}];
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
