import Ajv from 'ajv/dist/2020';
import scenarioSchema from './schemas/v1.0.0/scenario.json';
import actionSchema from './schemas/v1.0.0/action.json';
import fnSchema from './schemas/v1.0.0/fn.json';
import {ErrorObject} from "ajv/lib/types";

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
        ...validateActions(scenario),
    ];

    validate.errors = errors.length > 0 ? errors : null;

    return errors.length === 0;
}

function validateActions(scenario): ErrorObject[] {
    const errors: ErrorObject[] = [];

    if (Object.keys(scenario.actions || {}).length === 0) {
        errors.push({
            instancePath: '/actions',
            message: "must have at least one action",
            keyword: '',
            params: {},
            schemaPath: '',
        });
    }

    return errors;
}
