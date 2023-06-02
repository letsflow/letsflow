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
  responses?: Record<string, Response>;
  [_: string]: any
}

export interface Response {
  title?: string | Fn;
  update?: UpdateInstruction | UpdateInstruction[];
}

export interface UpdateInstruction {
  select: string;
  data?: any | Fn;
  patch?: boolean;
  if?: boolean | Fn;
}

export interface State {
  title?: string | Fn;
  instructions?: string | Record<string, string>;
  actions?: string[];
  transitions: Transition[];
}

export interface Transition {
  on?: string | { action: string; response?: string };
  if?: boolean | Fn;
  goto: string;
}

export interface SimpleState {
  title?: string | Fn;
  instructions?: string | Record<string, string>;
  on: string | { action: string; response?: string };
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
