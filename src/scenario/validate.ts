import Ajv from 'ajv';
import { ErrorObject } from 'ajv/dist/types';
import { ajv as defaultAjv } from '../ajv';
import { removeFn } from '../fn';
import { scenarioSchema } from '../schemas/v1.0';
import { Fn, Notify } from './interfaces';
import { EndState, Scenario, State, Transition } from './interfaces/scenario';
import { dedup, isFn } from './utils';

type DataWithSchema = { schema?: string; [_: string]: any };

export interface ValidateFunction<T extends boolean | Promise<boolean>> {
  (data: any, options?: { ajv?: Ajv }): T;
  errors?: null | ErrorObject[];
}

export const validate: ValidateFunction<boolean> = (scenario: any, options: { ajv?: Ajv } = {}) => {
  const ajv = options.ajv ?? defaultAjv;
  const validateScenario = ajv.compile(scenarioSchema);

  validateScenario(scenario);
  const errors = [
    ...(validateScenario.errors || []),
    ...validateActions(scenario, ajv),
    ...validateStates(scenario, ajv),
  ];

  validate.errors = errors.length > 0 ? errors : null;
  return errors.length === 0;
};

export const validateAsync: ValidateFunction<Promise<boolean>> = async (scenario: any, options: { ajv?: Ajv } = {}) => {
  const ajv = options.ajv ?? defaultAjv;
  const validateScenario = await ajv.compileAsync(scenarioSchema);

  await loadSubSchemas(scenario, ajv);

  const valid = validateScenario(scenario);
  const errors = [
    ...(validateScenario.errors || []),
    ...validateActions(scenario, ajv),
    ...validateStates(scenario, ajv),
  ];

  validate.errors = errors.length > 0 ? errors : null;
  return valid && errors.length === 0;
};

async function loadSubSchemas(scenario: Scenario, ajv: Ajv): Promise<void> {
  const actionSchemas = Object.values(scenario.actions ?? {})
    .map((action) => action?.schema)
    .filter((schema): schema is string => !!schema);

  const stateSchemas = Object.values(scenario.states ?? {})
    .map((state) => state?.schema)
    .filter((schema): schema is string => !!schema);

  const messageSchemas = Object.values(getNotifyMessages(scenario))
    .map(({ schema }) => schema)
    .filter((schema): schema is string => !!schema);

  const schemas = dedup([...actionSchemas, ...stateSchemas, ...messageSchemas]).map((schema) =>
    schema.includes(':') ? schema : `schema:${schema}`,
  );

  await Promise.all(schemas.map((schema) => ajv.compileAsync({ $ref: schema })));
}

function validateActions(scenario: Scenario, ajv: Ajv): ErrorObject[] {
  const actors = Object.keys(scenario.actors || { actor: {} });
  const errors: ErrorObject[] = [];

  Object.entries(scenario.actions || {}).forEach(([key, action]) => {
    if (action === null) return;

    if (action.actor && !isFn(action.actor)) {
      const actionActors = Array.isArray(action.actor) ? action.actor : [action.actor];
      errors.push(...validateActionActors(key, actionActors, actors));
    }

    errors.push(...validateSubSchema(`/actions/${key}`, action, ajv));
  });

  return errors;
}

function validateActionActors(key: string, actors: Array<string | Fn>, scenarioActors: string[]): ErrorObject[] {
  const errors: ErrorObject[] = [];

  for (const actor of actors) {
    if (!isFn(actor) && actor !== '*' && !actor.startsWith('service:') && !scenarioActors.includes(actor)) {
      errors.push(
        error(`/actions/${key}/actor`, 'must reference an actor or service', {
          value: actor,
          allowedValues: scenarioActors,
        }),
      );
    }
  }

  return errors;
}

function validateStates(scenario: Scenario, ajv: Ajv): ErrorObject[] {
  const states = Object.keys(scenario.states || {});
  const errors: ErrorObject[] = [];

  Object.entries(scenario.states || {}).forEach(([key, state]) => {
    if (state === null) return;

    if ('goto' in state && !states.includes(state.goto) && !state.goto.match(/^\(.*\)$/)) {
      errors.push(error(`/states/${key}/goto`, 'must reference a state', { value: state.goto, allowedValues: states }));
    }

    errors.push(...validateSubSchema(`/states/${key}`, state, ajv));

    const transitionErrors = state && !isEndState(state) ? validateTransitions(state, key, states) : [];
    errors.push(...transitionErrors);
  });

  Object.entries(getNotifyMessages(scenario)).forEach(([key, message]) => {
    errors.push(...validateSubSchema(key, message, ajv));
  });

  return errors;
}

function validateTransitions(state: State, key: string, states: string[]): ErrorObject[] {
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

function validateSubSchema(instancePath: string, data: DataWithSchema, ajv: Ajv): ErrorObject[] {
  if (!data.schema) return [];

  const validate = ajv.compile(data.schema.includes(':') ? { $ref: data.schema } : { $ref: `schema:${data.schema}` });
  validate(data);
  const originalErrors = validate.errors || [];

  const prunedData = removeFn(structuredClone(data));
  validate(prunedData);
  const prunedErrors = validate.errors || [];

  return originalErrors
    .filter((a) => prunedErrors.some((b) => isSameError(a, b)))
    .map((error) => ({
      ...error,
      instancePath: `${instancePath}${error.instancePath}`,
    }));
}

function isSameError(a: ErrorObject, b: ErrorObject): boolean {
  return (
    a.instancePath === b.instancePath &&
    a.schemaPath === b.schemaPath &&
    a.keyword === b.keyword &&
    a.message === b.message
  );
}

function getNotifyMessages(scenario: Scenario): Record<string, DataWithSchema> {
  const entries = Object.entries(scenario.states ?? {})
    .filter((entry): entry is [string, { notify: Notify | Notify[] }] => !!entry[1]?.notify)
    .map(
      ([key, state]): Array<[string, Notify]> =>
        Array.isArray(state.notify)
          ? state.notify.map((notify, index) => [`/states/${key}/notify/${index}`, notify])
          : [[`/states/${key}/notify`, state.notify]],
    )
    .flat()
    .map(([key, notify]): [string, DataWithSchema] =>
      notify?.message && !(typeof notify.message === 'string') && !isFn(notify.message)
        ? [`${key}/message`, notify.message as DataWithSchema]
        : [`${key}/message`, {} as DataWithSchema],
    );

  return Object.fromEntries(entries);
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
