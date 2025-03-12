import { expect } from 'chai';
import * as fs from 'fs/promises';
import { yaml } from '../../src';
import { ajv as defaultAjv } from '../../src/ajv';
import { chain, instantiate, predict, step } from '../../src/process';
import { normalize, NormalizedScenario, Scenario, validate } from '../../src/scenario';
import { processSchema } from '../../src/schemas/v1.0';

describe('import scenario', () => {
  let scenarioYaml: string;
  let scenario: Scenario;
  let normalized: NormalizedScenario;

  before(async () => {
    scenarioYaml = await fs.readFile(__dirname + '/test/scenario.yaml', 'utf8');
  });

  // Uncomment this block to generate the scenario.json and scenario-normalized.json file
  before(async () => {
    const parsed = yaml.parse(scenarioYaml);
    await fs.writeFile(__dirname + '/test/scenario.json', JSON.stringify(parsed, null, 2));
    await fs.writeFile(__dirname + '/test/scenario-normalized.json', JSON.stringify(normalize(parsed), null, 2));
  });

  before(async () => {
    const scenarioJson = await fs.readFile(__dirname + '/test/scenario.json', 'utf8');
    scenario = JSON.parse(scenarioJson);
  });

  before(async () => {
    const scenarioJson = await fs.readFile(__dirname + '/test/scenario-normalized.json', 'utf8');
    normalized = JSON.parse(scenarioJson);
  });

  it('should parse yaml', () => {
    const parsed = yaml.parse(scenarioYaml);
    expect(parsed).to.deep.eq(scenario);
  });

  it('should validate the parsed scenario', () => {
    const result = validate(scenario);

    expect(validate.errors).to.deep.eq(null);
    expect(result).to.be.true;
  });

  it('should normalize the parsed scenario', () => {
    expect(normalize(scenario)).to.deep.eq(normalized);
  });

  it('should validate the normalized scenario', () => {
    const result = validate(normalized);

    expect(validate.errors).to.deep.eq(null);
    expect(result).to.be.true;
  });

  describe('validate', () => {
    it('should validate the instantiated process', () => {
      const process = instantiate(normalized);
      const validate = defaultAjv.compile(processSchema);

      const data = JSON.parse(JSON.stringify(process));

      const result = validate(data);

      expect(validate.errors).to.deep.eq(null);
      expect(result).to.be.true;
    });

    it('should validate the predicted process', () => {
      const process = instantiate(normalized);
      const validate = defaultAjv.compile(processSchema);
      const next = predict(process);

      const data = JSON.parse(JSON.stringify({ ...process, next }));

      const result = validate(data);

      expect(validate.errors).to.deep.eq(null);
      expect(result).to.be.true;
    });

    it('should validate the stepped process', () => {
      const process = chain(
        instantiate(normalized),
        (process) => step(process, 'new_lead', 'company', { name: 'Acme Inc.', email: 'info@example.com' }),
        (process) => step(process, 'request_quote', 'client', { description: 'A new project', budget: 10000 }),
        (process) => step(process, 'create_quote', 'company', { document: 'quote.doc' }),
        (process) => step(process, 'accept', 'client'),
      );

      expect((process.events[process.events.length - 1] as any).errors).to.be.undefined;
      expect(process.current.key).to.eq('(success)');

      const validate = defaultAjv.compile(processSchema);

      const data = JSON.parse(JSON.stringify(process));
      const result = validate(data);

      expect(validate.errors).to.deep.eq(null);
      expect(result).to.be.true;
    });
  });
});
