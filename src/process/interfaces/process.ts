import { NormalizedScenario, Schema, Notify } from '../../scenario';

export interface Actor {
  id?: string;
  title: string;
  [key: string]: any;
}

export interface StartInstructions {
  scenario: string;
  actors?: Record<string, Omit<Actor, 'title'>>;
  vars?: Record<string, any>;
}

export interface InstantiateEvent {
  id: string;
  timestamp: Date;
  scenario: string;
  actors: Record<string, Omit<Actor, 'title'>>;
  vars: Record<string, any>;
  hash: string;
}

export interface ActionEvent {
  previous: string;
  timestamp: Date;
  action: string;
  actor: { key: string; id: string };
  response?: any;
  hash: string;
}

export interface TimeoutEvent {
  previous: string;
  timestamp: Date;
  hash: string;
}

export interface Action {
  $schema: string;
  key: string;
  title: string;
  description: string;
  actor: string[];
  responseSchema: Schema;

  [_: string]: any;
}

export interface State {
  key: string;
  timestamp: Date;
  title: string;
  description: string;
  instructions: Record<string, string>;
  notify: Array<Notify>;
  actions: Array<Action>;

  [_: string]: any;
}

export interface Process {
  id: string;
  title: string;
  scenario: { id: string } & NormalizedScenario;
  actors: Record<string, Actor>;
  vars: Record<string, any>;
  current: State;
  response?: any;
  events: Array<InstantiateEvent | ActionEvent | TimeoutEvent>;
}
