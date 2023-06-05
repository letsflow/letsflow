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
  actor?: string | string[];
  update?: UpdateInstruction | UpdateInstruction[];

  [_: string]: any;
}

export interface UpdateInstruction {
  select: string;
  data?: any | Fn;
  patch?: boolean;
  if?: boolean | Fn;
}

export type State = ExplicitState | SimpleState | SimpleTimeoutState;

interface BaseState {
  title?: string | Fn;
  description?: string | Fn;
  instructions?: Record<string, string>;
  actions?: string[];
}

interface SimpleState extends BaseState {
  on: string;
  goto: string;
}

interface SimpleTimeoutState extends BaseState {
  after: string | number;
  goto: string;
}

interface ExplicitState extends BaseState {
  transitions: Array<Transition>;
}

export interface EndState {
  title?: string | Fn;
  description?: string | Fn;
}

export type Transition = ActionTransition | TimeoutTransition;

interface ActionTransition {
  on: string;
  if?: boolean | Fn;
  goto: string;
}

interface TimeoutTransition {
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
  states: Record<string, State | EndState>;
  assets?: Record<string, JsonObjectSchema>;
}
