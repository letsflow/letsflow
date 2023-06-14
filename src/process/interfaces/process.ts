import { NormalizedScenario } from '../../scenario';

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

export interface Event {
  previous: string;
  timestamp: Date;
  action: string;
  response?: any;
  hash: string;
}

export interface Process {
  id: string;
  scenario: NormalizedScenario;
  actors: Record<string, Actor>;
  vars: Record<string, any>;
  state: string;
  response?: any;
  events: Array<InstantiateEvent | Event>;
}
