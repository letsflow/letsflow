import { expect } from 'chai';
import { createMessage, determineTrigger, instantiate } from '../../src/process';
import { normalize } from '../../src/scenario';

describe('createMessage', () => {
  it('should create a message for a service', () => {
    const scenario = normalize({
      states: {
        initial: {
          on: 'complete',
          by: 'service:default',
          goto: '(done)',
        },
      },
    });

    const process = instantiate(scenario);
    const message = createMessage(process, 'service:default');

    expect(message).to.deep.equal({
      actions: [
        {
          $schema: 'https://schemas.letsflow.io/v1.0/action',
          actor: ['service:default'],
          description: '',
          key: 'complete',
          response: {},
          title: 'complete',
        },
      ],
    });
  });

  it('should create a message for a with multiple actions', () => {
    const scenario = normalize({
      actions: {
        complete: {
          title: 'Complete',
          description: 'Complete the process',
          actor: 'service:default',
          response: 'string',
        },
        cancel: {
          title: 'Cancel',
          description: 'Cancel the process',
          actor: 'service:default',
        },
      },
      states: {
        initial: {
          transitions: [
            { on: 'complete', goto: '(done)' },
            { on: 'cancel', goto: '(cancelled)' },
          ],
        },
      },
    });

    const process = instantiate(scenario);
    const message = createMessage(process, 'default');

    expect(message).to.deep.equal({
      actions: [
        {
          $schema: 'https://schemas.letsflow.io/v1.0/action',
          actor: ['service:default'],
          description: 'Complete the process',
          key: 'complete',
          response: {
            type: 'string',
          },
          title: 'Complete',
        },
        {
          $schema: 'https://schemas.letsflow.io/v1.0/action',
          actor: ['service:default'],
          description: 'Cancel the process',
          key: 'cancel',
          response: {},
          title: 'Cancel',
        },
      ],
    });
  });

  it('should create a message for a service with instructions', () => {
    const scenario = normalize({
      states: {
        initial: {
          on: 'complete',
          by: 'service:default',
          goto: '(done)',
          instructions: {
            'service:default': 'complete the process',
          },
        },
      },
    });

    const process = instantiate(scenario);
    const message = createMessage(process, 'default');

    expect(message).to.deep.equal({
      actions: [
        {
          $schema: 'https://schemas.letsflow.io/v1.0/action',
          actor: ['service:default'],
          description: '',
          key: 'complete',
          response: {},
          title: 'complete',
        },
      ],
      instructions: 'complete the process',
    });
  });

  it('should create a message when no actions are available', () => {
    const scenario = normalize({
      states: {
        initial: {
          on: 'complete',
          goto: '(done)',
          notify: 'service:default',
        },
      },
    });

    const process = instantiate(scenario);
    const message = createMessage(process, 'default');

    expect(message).to.deep.equal({
      actions: [],
    });
  });
});

describe('determineTrigger', () => {
  it('should return the trigger from the notify object', () => {
    const scenario = normalize({
      states: {
        initial: {
          on: 'complete',
          by: 'service:default',
          goto: '(done)',
          notify: {
            service: 'default',
            trigger: 'complete',
          },
        },
      },
    });

    const process = instantiate(scenario);
    const trigger = determineTrigger(process, 'default');

    expect(trigger).to.equal('complete');
  });

  it('should return the trigger from the notify object as a function', () => {
    const scenario = normalize({
      states: {
        initial: {
          transitions: [
            { on: 'complete', goto: '(done)' },
            { on: 'cancel', goto: '(cancelled)' },
          ],
          notify: {
            service: 'default',
            trigger: { '<ref>': 'current.response.action' },
          },
        },
      },
    });

    const process = instantiate(scenario);
    const trigger = determineTrigger(process, 'default', { action: 'complete' });

    expect(trigger).to.equal('complete');
  });

  it('should return null if no trigger is available', () => {
    const scenario = normalize({
      states: {
        initial: {
          on: 'complete',
          goto: '(done)',
          notify: 'service:default',
        },
      },
    });

    const process = instantiate(scenario);
    const trigger = determineTrigger(process, 'default');

    expect(trigger).to.be.null;
  });
});
