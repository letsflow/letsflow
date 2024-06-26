import * as fs from 'fs/promises';
import { NormalizedScenario, Scenario, normalize, validate } from '../../src/scenario';
import { yaml } from '../../src';
import { expect } from 'chai';

describe('import scenario', () => {
  let scenarioYaml: string;
  let scenario: Scenario;
  let normalized: NormalizedScenario;

  // Uncomment this block to generate the scenario.json and scenario-normalized.json file
  before(async () => {
    //const scenario = yaml.parse(scenarioYaml);
    //await fs.writeFile(__dirname + '/test/scenario.json', JSON.stringify(scenario, null, 2));
    //await fs.writeFile(__dirname + '/test/scenario-normalized.json', JSON.stringify(normalize(scenario), null, 2));
  });

  before(async () => {
    scenarioYaml = await fs.readFile(__dirname + '/test/scenario.yaml', 'utf8');
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
});
