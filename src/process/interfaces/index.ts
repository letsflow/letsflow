import { NormalizedScenario, Schema } from '../../scenario/interfaces';

export interface Actor {
  id?: string;
  role?: string | string[];
  title: string;
  [key: string]: any;
}

export interface InstantiateEvent {
  id: string;
  timestamp: Date;
  scenario: string;
  hash: string;
}

export interface ActionEvent {
  previous: string;
  timestamp: Date;
  action: string;
  actor: { key: string; id?: string; [_: string]: any };
  response?: any;
  skipped: boolean;
  errors?: string[];
  hash: string;
}

export interface TimeoutEvent {
  previous: string;
  timestamp: Date;
  hash: string;
}

export type Event = InstantiateEvent | ActionEvent | TimeoutEvent;

export interface Action {
  $schema: string;
  key: string;
  title: string;
  description: string;
  actor: string[];
  response: Schema;

  [_: string]: any;
}

export interface Notify {
  service: string;
  after: number;
  trigger?: string;
  message?: string | Record<string, any>;
}

export interface State {
  key: string;
  timestamp: Date;
  title: string;
  description: string;
  instructions: Record<string, string>;
  notify: Array<Notify>;
  actions: Array<Action>;
  response?: any;

  [_: string]: any;
}

export interface Index {
  id: string;
  title: string;
  tags: string[];
  scenario: { id: string } & NormalizedScenario;
  actors: Record<string, Actor>;
  vars: Record<string, any>;
  result: any;
  current: State;
  events: Array<Event>;
}

export type PredictedState = Omit<State, 'timestamp' | 'notify'>;

export type HashFn = <T extends Event>(event: Omit<T, 'hash'>) => T;
