import { NormalizedScenario, Scenario, normalize, validate } from '../../src/scenario';
import { yaml } from '../../src';
import { expect } from 'chai';

const scenarioYaml = `
title: Quote
actors:
  company:
  client:
    properties:
      name: string
      email: string

actions:
  new_lead:
    actor: company
    update:
      select: actors.client
  introduce_company:
    $schema: https://example.com/schemas/message
    actor: company
    recipient: !ref actors.client
    template: introduce_company
  request_quote:
    $schema: https://example.com/schemas/form
    actor: client
    form: general_quote
    update:
      select: vars.quote_request
  send_quote:
    $schema: https://example.com/schemas/reply
    actor: company
    recipient: !ref actors.client
  send_reminder:
    $schema: https://example.com/schemas/message
    actor: company
    recipient: !ref actors.client
    template: quote_reminder
    update:
      select: vars.reminded
      data: true
  set_client_info:
    $schema: https://example.com/schemas/form
    actor: company    
    data: !ref actors.client
    data_schema: !ref scenario.actors.client
    update:
      select: actors.client
  accept:
    actor: client
  reject:
    actor: client
  cancel:
    actor: company
  
states:
  initial:
    on: new_lead
    goto: introduction
  introduction:
    on: introduce_company
    goto: wait_on_client
  wait_on_client:
    actions:
      - request_quote
      - cancel
      - set_client_info
    transitions:
      - on: request_quote
        goto: send_quote
      - on: cancel
        goto: (canceled)
      - after: 5 days
        goto: remind_client
        if: !ref '!vars.reminded'
      - after: 10 days  
        goto: (failed)
        if: !ref vars.reminded
  remind_client:
    on: send_reminder
    goto: wait_on_client
  send_quote:
    actions:
      - accept
      - reject
      - set_client_info
    instructions:
      company: !sub |
        \${actors.client.name}
        \${vars.quote_request.description}
    transitions:
      - on: accept
        goto: (success)
      - on: reject
        goto: (failed)
    
vars:
  quote_request:
    properties:
      description: string
  reminded: boolean
`;

describe('import scenario', () => {
  let scenario: Scenario;
  let normalized: NormalizedScenario;

  it('should parse yaml', () => {
    scenario = yaml.parse(scenarioYaml);

    expect(scenario).to.deep.eq({
      title: 'Quote',
      actors: {
        company: null,
        client: {
          properties: {
            name: 'string',
            email: 'string',
          },
        },
      },
      actions: {
        new_lead: {
          actor: 'company',
          update: {
            select: 'actors.client',
          },
        },
        introduce_company: {
          $schema: 'https://example.com/schemas/message',
          actor: 'company',
          recipient: { '<ref>': 'actors.client' },
          template: 'introduce_company',
        },
        request_quote: {
          $schema: 'https://example.com/schemas/form',
          actor: 'client',
          form: 'general_quote',
          update: {
            select: 'vars.quote_request',
          },
        },
        send_quote: {
          $schema: 'https://example.com/schemas/reply',
          actor: 'company',
          recipient: { '<ref>': 'actors.client' },
        },
        send_reminder: {
          $schema: 'https://example.com/schemas/message',
          actor: 'company',
          recipient: { '<ref>': 'actors.client' },
          template: 'quote_reminder',
          update: {
            select: 'vars.reminded',
            data: true,
          },
        },
        set_client_info: {
          $schema: 'https://example.com/schemas/form',
          actor: 'company',
          data: { '<ref>': 'actors.client' },
          data_schema: { '<ref>': 'scenario.actors.client' },
          update: {
            select: 'actors.client',
          },
        },
        accept: {
          actor: 'client',
        },
        reject: {
          actor: 'client',
        },
        cancel: {
          actor: 'company',
        },
      },
      states: {
        initial: {
          on: 'new_lead',
          goto: 'introduction',
        },
        introduction: {
          on: 'introduce_company',
          goto: 'wait_on_client',
        },
        wait_on_client: {
          actions: ['request_quote', 'cancel', 'set_client_info'],
          transitions: [
            {
              on: 'request_quote',
              goto: 'send_quote',
            },
            {
              on: 'cancel',
              goto: '(canceled)',
            },
            {
              after: '5 days',
              goto: 'remind_client',
              if: { '<ref>': '!vars.reminded' },
            },
            {
              after: '10 days',
              goto: '(failed)',
              if: { '<ref>': 'vars.reminded' },
            },
          ],
        },
        remind_client: {
          on: 'send_reminder',
          goto: 'wait_on_client',
        },
        send_quote: {
          actions: ['accept', 'reject', 'set_client_info'],
          instructions: {
            company: { '<sub>': '${actors.client.name}\n${vars.quote_request.description}\n' },
          },
          transitions: [
            {
              on: 'accept',
              goto: '(success)',
            },
            {
              on: 'reject',
              goto: '(failed)',
            },
          ],
        },
      },
      vars: {
        quote_request: {
          properties: {
            description: 'string',
          },
        },
        reminded: 'boolean',
      },
    });
  });

  it('should validate the parsed scenario', () => {
    const result = validate(scenario);

    expect(validate.errors).to.deep.eq(null);
    expect(result).to.be.true;
  });

  it('should normalize the parsed scenario', () => {
    normalized = normalize(scenario);

    expect(normalized).to.deep.eq({
      $schema: 'https://specs.letsflow.io/v1.0.0/scenario',
      title: 'Quote',
      description: '',
      actors: {
        client: {
          title: 'client',
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
          },
        },
        company: {
          title: 'company',
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
          },
        },
      },
      actions: {
        accept: {
          $schema: 'https://specs.letsflow.io/v1.0.0/action',
          actor: 'client',
          description: '',
          title: 'accept',
          update: [],
        },
        cancel: {
          $schema: 'https://specs.letsflow.io/v1.0.0/action',
          actor: 'company',
          description: '',
          title: 'cancel',
          update: [],
        },
        introduce_company: {
          $schema: 'https://example.com/schemas/message',
          actor: 'company',
          description: '',
          recipient: { '<ref>': 'actors.client' },
          template: 'introduce_company',
          title: 'introduce company',
          update: [],
        },
        new_lead: {
          $schema: 'https://specs.letsflow.io/v1.0.0/action',
          actor: 'company',
          description: '',
          title: 'new lead',
          update: [
            {
              select: 'actors.client',
              data: { '<ref>': 'response' },
              patch: false,
              if: true,
            },
          ],
        },
        reject: {
          $schema: 'https://specs.letsflow.io/v1.0.0/action',
          actor: 'client',
          description: '',
          title: 'reject',
          update: [],
        },
        request_quote: {
          $schema: 'https://example.com/schemas/form',
          actor: 'client',
          description: '',
          form: 'general_quote',
          title: 'request quote',
          update: [
            {
              select: 'vars.quote_request',
              data: { '<ref>': 'response' },
              patch: false,
              if: true,
            },
          ],
        },
        send_quote: {
          $schema: 'https://example.com/schemas/reply',
          actor: 'company',
          description: '',
          recipient: { '<ref>': 'actors.client' },
          title: 'send quote',
          update: [],
        },
        send_reminder: {
          $schema: 'https://example.com/schemas/message',
          actor: 'company',
          description: '',
          recipient: { '<ref>': 'actors.client' },
          template: 'quote_reminder',
          title: 'send reminder',
          update: [
            {
              select: 'vars.reminded',
              data: true,
              patch: false,
              if: true,
            },
          ],
        },
        set_client_info: {
          $schema: 'https://example.com/schemas/form',
          actor: 'company',
          data: { '<ref>': 'actors.client' },
          data_schema: { '<ref>': 'scenario.actors.client' },
          description: '',
          title: 'set client_info',
          update: [
            {
              select: 'actors.client',
              data: { '<ref>': 'response' },
              patch: false,
              if: true,
            },
          ],
        },
      },
      states: {
        initial: {
          actions: ['new_lead'],
          description: '',
          instructions: {},
          title: 'initial',
          transitions: [
            {
              on: 'new_lead',
              goto: 'introduction',
              if: true,
            },
          ],
        },
        introduction: {
          actions: ['introduce_company'],
          description: '',
          instructions: {},
          title: 'introduction',
          transitions: [
            {
              on: 'introduce_company',
              goto: 'wait_on_client',
              if: true,
            },
          ],
        },
        remind_client: {
          actions: ['send_reminder'],
          description: '',
          instructions: {},
          title: 'remind client',
          transitions: [
            {
              on: 'send_reminder',
              goto: 'wait_on_client',
              if: true,
            },
          ],
        },
        send_quote: {
          actions: ['accept', 'reject', 'set_client_info'],
          description: '',
          instructions: {
            company: {
              '<sub>': '${actors.client.name}\n${vars.quote_request.description}\n',
            },
          },
          title: 'send quote',
          transitions: [
            {
              on: 'accept',
              goto: '(success)',
              if: true,
            },
            {
              on: 'reject',
              goto: '(failed)',
              if: true,
            },
          ],
        },
        wait_on_client: {
          actions: ['request_quote', 'cancel', 'set_client_info'],
          description: '',
          instructions: {},
          title: 'wait on_client',
          transitions: [
            {
              on: 'request_quote',
              goto: 'send_quote',
              if: true,
            },
            {
              on: 'cancel',
              goto: '(canceled)',
              if: true,
            },
            {
              after: 432000,
              goto: 'remind_client',
              if: { '<ref>': '!vars.reminded' },
            },
            {
              after: 864000,
              goto: '(failed)',
              if: { '<ref>': 'vars.reminded' },
            },
          ],
        },
      },
      vars: {
        quote_request: {
          title: 'quote request',
          type: 'object',
          properties: {
            description: { type: 'string' },
          },
        },
        reminded: {
          title: 'reminded',
          type: 'boolean',
        },
      },
    });
  });

  it('should validate the normalized scenario', () => {
    const result = validate(normalized);

    expect(validate.errors).to.deep.eq(null);
    expect(result).to.be.true;
  });
});
