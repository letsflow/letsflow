export type Fn = FnRef | FnEval | FnTpl;

export interface JsonObjectSchema {
  type?: 'object';
  title?: string;
  description?: string;
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean | Record<string, any>;
}

interface FnRef {
  '<ref>': string;
}

interface FnEval {
  '<eval>': string;
}

interface FnTpl {
  '<tpl>': string;
}

export interface Action {
  $schema?: string;
  title?: string;
  description?: string | Fn;
  actor?: string | string[] | Fn;
  update?: UpdateInstruction | UpdateInstruction[];
  [_: string]: any
}

export interface UpdateInstruction {
  select: string;
  data?: any | Fn;
  patch?: boolean;
  if?: boolean | Fn;
}

export interface SimpleState {
  title?: string | Fn;
  instructions?: string | Record<string, string>;
  on: string;
  goto: string;
}

export interface State {
  title?: string | Fn;
  instructions?: string | Record<string, string>;
  transitions: Array<Transition | TimeoutTransition>;
}

export interface Transition {
  on: string;
  if?: boolean | Fn;
  goto: string;
}

export interface TimeoutTransition {
  after: string | number;
  if?: boolean | Fn;
  goto: string;
}

export interface Scenario {
  $schema?: string;
  title: string;
  description?: string;

  actors?: Record<string, JsonObjectSchema>;
  actions: Record<string, Action>;
  states: Record<string, State | SimpleState>;
  assets?: Record<string, JsonObjectSchema>;
}
