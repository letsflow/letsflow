import fnSchema from './v1.0.0/fn.json';
import schemaSchema from './v1.0.0/schema.json';
import actionSchema from './v1.0.0/action.json';
import scenarioSchema from './v1.0.0/scenario.json';
import formSchema from './v1.0.0/form.json';

const schemas = {
  'v1.0.0': {
    fn: fnSchema,
    schema: schemaSchema,
    action: actionSchema,
    scenario: scenarioSchema,
    form: formSchema,
  },
};

export default schemas;
