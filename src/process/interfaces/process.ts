import { NormalizedScenario, Schema } from '../../scenario/interfaces';
import { Event } from './event';

export interface Actor {
  id?: string;
  role?: string | string[];
  title: string;
  [key: string]: any;
}

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

  [_: string]: any;
}

export interface Process {
  id: string;
  title: string;
  tags: string[];
  scenario: { id: string } & NormalizedScenario;
  actors: Record<string, Actor>;
  vars: Record<string, any>;
  result: any;
  current: State;
  previous: Array<LogEntry>;
  next?: Array<PredictedState>;
  events: Array<Event>;
}

export interface LogEntry {
  title: string;
  description?: string;
  timestamp: Date;
  actor?: { key: string; id?: string; [_: string]: any };
}

export type PredictedState = Omit<State, 'timestamp' | 'notify'>;

export type HashFn = <T extends Event>(event: Omit<T, 'hash'>) => T;
