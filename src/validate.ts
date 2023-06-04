import Ajv from 'ajv/dist/2020';
import scenarioSchema from './schemas/v1.0.0/scenario.json';
import actionSchema from './schemas/v1.0.0/action.json';
import fnSchema from './schemas/v1.0.0/fn.json';
import {ErrorObject} from "ajv/lib/types";
import {Scenario, State} from "./interfaces/scenario";

export interface ValidateFunction {
    (data: any): boolean
    errors?: null | ErrorObject[]
}

const ajv = new Ajv();
ajv.addSchema([actionSchema, fnSchema]);

const validateSchema = ajv.compile(scenarioSchema);

export const validate: ValidateFunction = (scenario: any): boolean => {
    validateSchema(scenario);

    const errors = [
        ...(validateSchema.errors || []),
        ...validateStates(scenario),
    ];

    validate.errors = errors.length > 0 ? errors : null;

    return errors.length === 0;
}

function validateStates(scenario: Scenario): ErrorObject[] {
    const actions = Object.keys(scenario.actions || {});
    const states = Object.keys(scenario.states || {});

    return Object.entries(scenario.states || {}).map(([key, state]) => {
        const errors: ErrorObject[] = [];
        if ('on' in state && !actions.includes(state.on)) {
            errors.push(error(
                `/states/${key}/on`,
                'must reference an action',
                { allowedValues: actions },
            ));
        }

        if ('goto' in state && !states.includes(state.goto) && !state.goto.match(/^\(.*\)$/)) {
            errors.push(error(
                `/states/${key}/goto`,
                'must reference a state',
                { allowedValues: states },
            ));
        }

        if (!('transitions' in state)) return errors;

        return [
            ...errors,
            ...(validateTransitions(state, actions, states)),
        ];
    }).flat();
}

function validateTransitions(state: State, actions: string[], states: string[]): ErrorObject[] {
    if (!('transitions' in state)) return [];

    const errors: ErrorObject[] = [];

    Object.entries(state.transitions || {}).forEach(([key, transition]) => {
        if ('on' in transition && !actions.includes(transition.on)) {
            errors.push(error(
                `/states/${key}/transitions/${transition}/on`,
                'must reference an action',
                { allowedValues: actions },
            ));
        }

        if ('goto' in transition && !states.includes(transition.goto) && !transition.goto.match(/^\(.*\)$/)) {
            errors.push(error(
                `/states/${key}/transitions/${transition}/goto`,
                'must reference a state',
                { allowedValues: states },
            ));
        }
    });

    return errors;
}

function error(instancePath, message, params: Record<string, any> = {}): ErrorObject {
    return {
        instancePath,
        keyword: '',
        message,
        params,
        schemaPath: '',
    };
}
