import Ajv from 'ajv';
import { ErrorObject } from 'ajv/dist/types';
import { ajv as defaultAjv } from '../ajv';

import { scenarioSchema } from '../schemas/v1.0';
import { EndState, Notify, Scenario, State, Transition } from './interfaces/scenario';
import { isFn } from './utils';

export interface ValidateFunction {
  (data: any): boolean;
  errors?: null | ErrorObject[];
}

export const validate: ValidateFunction = (scenario: any, options: { ajv?: Ajv } = {}): boolean => {
  const ajv = options.ajv ?? defaultAjv;
  const validateScenario = ajv.compile(scenarioSchema);

  validateScenario(scenario);
  const errors = [...(validateScenario.errors || []), ...validateActions(scenario), ...validateStates(scenario)];

  validate.errors = errors.length > 0 ? errors : null;
  return errors.length === 0;
};

function validateActions(scenario: Scenario): ErrorObject[] {
  const actors = Object.keys(scenario.actors || { actor: {} });
  const services = Object.values(scenario.states)
    .filter((state): state is State => state !== null && 'notify' in state)
    .map((state) => state.notify)
    .flat()
    .map((notify: Notify | string) => (typeof notify === 'string' ? notify : notify.service))
    .map((service) => `service:${service}`);
  const allowedValues = [...actors, ...services];
  const errors: ErrorObject[] = [];

  Object.entries(scenario.actions || {}).forEach(([key, action]) => {
    if (action === null || !action.actor || isFn(action.actor)) return;

    const actionActors = Array.isArray(action.actor) ? action.actor : [action.actor];

    for (const actor of actionActors) {
      if (!isFn(actor) && actor !== '*' && !allowedValues.includes(actor)) {
        errors.push(
          error(`/actions/${key}/actor`, 'must reference an actor or service', {
            value: actor,
            allowedValues: allowedValues,
          }),
        );
      }
    }
  });

  return errors;
}

function validateStates(scenario: Scenario): ErrorObject[] {
  const actions = Object.keys(scenario.actions || {});
  const states = Object.keys(scenario.states || {});

  return Object.entries(scenario.states || {})
    .map(([key, state]) => {
      const errors: ErrorObject[] = [];

      if (state !== null && 'goto' in state && !states.includes(state.goto) && !state.goto.match(/^\(.*\)$/)) {
        errors.push(
          error(`/states/${key}/goto`, 'must reference a state', { value: state.goto, allowedValues: states }),
        );
      }

      const transitionErrors = state && !isEndState(state) ? validateTransitions(state, key, actions, states) : [];

      return [...errors, ...transitionErrors];
    })
    .flat();
}

function validateTransitions(state: State, key: string, actions: string[], states: string[]): ErrorObject[] {
  if (!('transitions' in state) || !Array.isArray(state.transitions)) return [];

  const errors: ErrorObject[] = [];

  Object.entries(state.transitions || {}).forEach(([index, transition]: [string, Transition]) => {
    if (
      'goto' in transition &&
      transition.goto !== null &&
      !states.includes(transition.goto) &&
      !transition.goto.match(/^\(.*\)$/)
    ) {
      errors.push(
        error(`/states/${key}/transitions/${index}/goto`, 'must reference a state', {
          value: transition.goto,
          allowedValues: states,
        }),
      );
    }
  });

  return errors;
}

export function isEndState(state: { transitions: any } | { goto: any } | EndState): state is EndState {
  return !('transitions' in state || 'goto' in state);
}

function error(instancePath: string, message: string, params: Record<string, any> = {}): ErrorObject {
  return {
    instancePath,
    keyword: '',
    message,
    params,
    schemaPath: '',
  };
}
