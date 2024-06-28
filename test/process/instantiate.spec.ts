import { normalize, NormalizedScenario } from '../../src/scenario';
import { instantiate, InstantiateEvent } from '../../src/process';
import { expect } from 'chai';
import { hash } from '../../src/process/hash';

describe('instantiate process', () => {
  it('should instantiate from a scenario', () => {
    const scenario: NormalizedScenario = normalize({
      title: 'some scenario',
      actions: {
        complete: {
          description: { '<sub>': 'Complete ${scenario.title}' },
        },
      },
      states: {
        initial: {
          on: 'complete',
          goto: '(done)',
        },
      },
    });

    const process = instantiate(scenario, {
      scenario: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      actors: {},
      vars: {},
    });

    expect(process.scenario).to.deep.eq(scenario);
    expect(process.actors).to.deep.eq({
      actor: { title: 'actor' },
    });
    expect(process.vars).to.deep.eq({});

    expect(process.events.length).to.eq(1);
    const { hash: eventHash, ...event } = process.events[0] as InstantiateEvent;
    expect(event.timestamp).to.be.instanceof(Date);
    expect(event.scenario).to.eq('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
    expect(event.actors).to.deep.eq({});
    expect(event.vars).to.deep.eq({});
    expect(eventHash).to.eq(hash(event));

    expect(process.current.key).to.eq('initial');
    expect(process.current.title).to.eq('initial');
    expect(process.current.timestamp).to.eq(event.timestamp);
    expect(process.current.actions).to.have.length(1);
    expect(process.current.actions[0]).to.deep.eq({
      $schema: 'https://specs.letsflow.io/v1.0.0/action',
      title: 'complete',
      description: 'Complete some scenario',
      actor: ['actor'],
      responseSchema: {},
      key: 'complete',
    });
  });

  it('should instantiate actors', () => {
    const scenario: NormalizedScenario = normalize({
      title: 'some scenario',
      actors: {
        user: {
          title: 'Main user',
          properties: {
            name: { type: 'string' },
            verified: { type: 'boolean', default: false },
          },
        },
        admin: {},
        'signer_*': {},
      },
      actions: {
        complete: {},
      },
      states: {
        initial: {
          on: 'complete',
          goto: '(done)',
        },
      },
    });

    const process = instantiate(scenario, {
      scenario: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      actors: {
        user: { id: 'eb82534d-1b99-415f-8d32-096070ea3310' },
      },
      vars: {},
    });

    expect(process.actors.user).to.deep.eq({
      title: 'Main user',
      id: 'eb82534d-1b99-415f-8d32-096070ea3310',
      verified: false,
    });

    expect(process.actors.admin).to.deep.eq({
      title: 'admin',
    });

    expect(Object.keys(process.actors)).to.deep.eq(['user', 'admin']);
  });

  it('should instantiate vars', () => {
    const scenario: NormalizedScenario = normalize({
      title: 'some scenario',
      actions: {
        complete: {},
      },
      states: {
        initial: {
          on: 'complete',
          goto: '(done)',
        },
      },
      vars: {
        foo: { type: 'string' },
        bar: { type: 'integer', default: 10 },
        qux: { type: 'string' },
      },
    });

    const process = instantiate(scenario, {
      scenario: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      actors: {},
      vars: {
        foo: 'hello',
      },
    });

    expect(process.vars).to.deep.eq({
      foo: 'hello',
      bar: 10,
    });
  });
});
