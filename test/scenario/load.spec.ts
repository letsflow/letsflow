import Ajv from 'ajv/dist/2020';
import { expect } from 'chai';
import sinon from 'sinon';
import { loadSchemas, normalize } from '../../src/scenario';
import { actionSchema, actorSchema, fnSchema, scenarioSchema, schemaSchema } from '../../src/schemas/v1.0.0';

describe('loadSchemas', () => {
  let ajv: Ajv;
  let fetchSchema: sinon.SinonStub;

  beforeEach(() => {
    fetchSchema = sinon.stub().callsFake(async (uri) => ({ $id: uri }));

    ajv = new Ajv({ allErrors: true, loadSchema: fetchSchema });
    ajv.addKeyword('$anchor');
    ajv.addSchema([scenarioSchema, actionSchema, actorSchema, fnSchema, schemaSchema]);
  });

  it('should load all schemas used in a scenario', async () => {
    const scenario = normalize({
      actors: {
        manager: {
          $ref: 'https://schemas.example.com/actors/manager',
        },
        client: {
          properties: {
            name: 'string',
            organization: 'https://schemas.example.com/objects/organization',
          },
        },
      },
      actions: {
        create: {
          $schema: 'https://schemas.example.com/actions/create',
          response: 'https://schemas.example.com/responses/create',
        },
        update: {
          response: {
            properties: {
              contract: 'https://schemas.example.com/objects/contract',
            },
          },
        },
      },
      states: {},
      vars: {
        plan: 'https://schemas.example.com/objects/plan',
        level: {
          properties: {
            game: 'https://schemas.example.com/objects/game',
          },
        },
      },
      result: 'https://schemas.example.com/objects/dossier',
    });

    await loadSchemas(scenario, { ajv });

    expect(fetchSchema.calledWith('https://schemas.example.com/actors/manager')).to.be.true;
    expect(fetchSchema.calledWith('https://schemas.example.com/objects/organization')).to.be.true;
    expect(fetchSchema.calledWith('https://schemas.example.com/responses/create')).to.be.true;
    expect(fetchSchema.calledWith('https://schemas.example.com/objects/contract')).to.be.true;
    expect(fetchSchema.calledWith('https://schemas.example.com/objects/plan')).to.be.true;
    expect(fetchSchema.calledWith('https://schemas.example.com/objects/game')).to.be.true;
    expect(fetchSchema.calledWith('https://schemas.example.com/objects/dossier')).to.be.true;
    expect(fetchSchema.calledWith('https://schemas.example.com/actions/create')).to.be.false;
    expect(fetchSchema.callCount).to.equal(7);

    expect(ajv.getSchema('https://schemas.example.com/actors/manager')?.schema).to.be.deep.equal({
      $id: 'https://schemas.example.com/actors/manager',
    });
    expect(ajv.getSchema('https://schemas.example.com/objects/organization')?.schema).to.be.deep.equal({
      $id: 'https://schemas.example.com/objects/organization',
    });

    expect(ajv.getSchema('https://schemas.example.com/not-used')).to.be.undefined;
  });

  it('should filter out schemas with empty objects', async () => {
    const scenario = normalize({
      actors: {
        manager: null,
        client: {
          properties: {
            name: 'string',
            organization: 'https://schemas.example.com/objects/organization',
          },
        },
      },
      actions: {
        create: {
          response: 'https://schemas.example.com/responses/create',
        },
        update: {
          response: {},
        },
      },
      states: {},
    });

    await loadSchemas(scenario, { ajv });

    expect(fetchSchema.calledWith('https://schemas.example.com/objects/organization')).to.be.true;
    expect(fetchSchema.calledWith('https://schemas.example.com/responses/create')).to.be.true;
    expect(fetchSchema.callCount).to.equal(2);
  });

  it('should handle missing optional fields gracefully', async () => {
    const scenario = normalize({
      states: {},
    });

    await loadSchemas(scenario, { ajv });

    expect(fetchSchema.notCalled).to.be.true;
  });

  it('should load a schema only once', async () => {
    const scenario = normalize({
      vars: {
        organization: 'https://schemas.example.com/objects/organization',
      },
      states: {},
    });

    fetchSchema.resolves({ type: 'object', additionalProperties: true });

    await loadSchemas(scenario, { ajv });
    await loadSchemas(scenario, { ajv });

    expect(fetchSchema.calledOnceWith('https://schemas.example.com/objects/organization')).to.be.true;
    expect(fetchSchema.callCount).to.equal(1);

    expect(ajv.getSchema('https://schemas.example.com/objects/organization')?.schema).to.be.deep.equal({
      type: 'object',
      additionalProperties: true,
    });
  });
});
