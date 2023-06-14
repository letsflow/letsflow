import { normalize, NormalizedScenario } from '../../src/scenario';
import { instantiate, InstantiateEvent } from '../../src/process';
import { expect } from 'chai';
import { hash } from '../../src/process/hash';

describe('instantiate process', () => {
  it('should instantiate from a minimal scenario', () => {
    const scenario: NormalizedScenario = normalize({
      title: 'minimal scenario',
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
      actors: {},
      vars: {},
    });

    expect(process.scenario).to.deep.eq(scenario);
    expect(process.actors).to.deep.eq({
      actor: { title: 'actor' },
    });
    expect(process.vars).to.deep.eq({});
    expect(process.state).to.eq('initial');

    expect(process.events.length).to.eq(1);
    const { hash: eventHash, ...event } = process.events[0] as InstantiateEvent;
    expect(event.timestamp).to.be.instanceof(Date);
    expect(event.scenario).to.eq('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
    expect(event.actors).to.deep.eq({});
    expect(event.vars).to.deep.eq({});
    expect(eventHash).to.eq(hash(event));
  });

  it('should instantiate actors', () => {
    const scenario: NormalizedScenario = normalize({
      title: 'minimal scenario',
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
      actors: {},
      vars: {},
    });

    expect(process.actors.user).to.deep.eq({
      title: 'Main user',
      verified: false,
    });

    expect(process.actors.admin).to.deep.eq({
      title: 'admin',
    });

    expect(Object.keys(process.actors)).to.deep.eq(['user', 'admin']);
  });
});
