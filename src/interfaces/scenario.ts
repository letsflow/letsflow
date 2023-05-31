import { Fn } from './fn';

export interface Actor {
  schema: string;
  key: string;
  title: string | Fn;
}

export interface Action {
  schema: string;
  key: string;
  title: string | Fn;
  description?: string | Fn;
  actors: string | string[] | Fn;
  responses: Response[];
}

export interface Response {
  title: string | Fn;
  key: string;
  update: UpdateInstruction[];
}

export interface UpdateInstruction {
  select: string | Fn;
  data: any | Fn;
  patch: boolean;
  projection?: string;
  condition: boolean | Fn;
}

export interface State {
  key: string;
  title: string | Fn;
  description?: string | Fn;
  actions: string[];
  transitions: Transition[];
}

export interface Transition {
  action: string;
  response?: string;
  condition: boolean | Fn;
  target: string;
}

export interface Scenario {
  id?: string;
  title: string;
  description?: string;

  actors: Actor[];
  actions: Action[];
  states: State[];

  data?: {
    $schema?: string;
    [key: string]: any;
  };
}
