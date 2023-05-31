import { Fn } from './fn';

export interface Actor {
  $schema?: string;
  title?: string | Fn;
}

export interface Action {
  $schema?: string;
  title?: string | Fn;
  description?: string | Fn;
  actor?: string | string[] | Fn;
  responses?: Record<string, Response>;
}

export interface Response {
  title: string | Fn;
  update?: UpdateInstruction | UpdateInstruction[];
}

export interface UpdateInstruction {
  select: string;
  data: any | Fn;
  patch?: boolean;
  apply?: string;
  if?: boolean | Fn;
}

export interface State {
  title?: string | Fn;
  description?: string | Fn;
  transitions: Transition[];
}

export interface Transition {
  on: string;
  if?: boolean | Fn;
  goto: string;
}

export interface SimpleState {
  title?: string | Fn;
  description?: string | Fn;
  on: string;
  goto: string;
}

export interface Scenario {
  $schema?: string;
  title: string;
  description?: string;

  actors: Record<string, Actor>;
  actions: Record<string, Action>;
  states: Record<string, State | SimpleState>;
  data?: {
    $schema?: string;
    [key: string]: any;
  };
}
