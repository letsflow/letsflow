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

export interface Action {
  $schema: string;
  title: string;
  description: string;
  actor: string[];
  update: UpdateInstruction[];

  [_: string]: any;
}

export interface UpdateInstruction {
  select: string;
  data: any;
  patch: boolean;
  if: boolean;
}

export interface State {
  key: string;
  title: string;
  description: string;
  instructions: Record<string, string>;
  actions: Record<string, Action>;
}

export interface Process {
  id: string;
  scenario: NormalizedScenario;
  actors: Record<string, Actor>;
  vars: Record<string, any>;
  current: State;
  response?: any;
  events: Array<InstantiateEvent | Event>;
}
