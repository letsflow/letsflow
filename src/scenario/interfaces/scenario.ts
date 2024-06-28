import { Fn } from './fn';

export interface Schema {
  $ref?: string;
  type?: string;
  title?: string;
  default?: any;
  description?: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
  additionalProperties?: boolean | Record<string, any>;
}

export interface Action {
  $schema?: string;
  title?: string;
  description?: string | Fn;
  actor?: string | Fn | Array<string | Fn>;
  responseSchema?: string | Schema | Fn;
  update?: string | UpdateInstruction | UpdateInstruction[];
}

export interface UpdateInstruction {
  path: string | Fn;
  data?: any | Fn;
  merge?: boolean;
  if?: boolean | Fn;
}

export type State = ExplicitState | SimpleState | SimpleTimeoutState;

interface BaseState {
  title?: string | Fn;
  description?: string | Fn;
  instructions?: Record<string, string>;
  actions?: string[];
  notify?: Array<Notification>
}

interface SimpleState extends BaseState {
  on: string;
  goto: string;
}

interface SimpleTimeoutState extends BaseState {
  after: string | number;
  goto: string;
}

export interface ExplicitState extends BaseState {
  transitions: Array<Transition>;
}

export interface EndState {
  title?: string | Fn;
  description?: string | Fn;
  instructions?: Record<string, string>;
  notify?: Array<Notification>
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

interface Notification {
  method: string;
  [_: string]: any;
}

export interface Scenario {
  $schema?: string;
  name?: string;
  version?: string;
  title: string;
  description?: string;

  actors?: Record<string, Schema | null>;
  actions: Record<string, Action | null>;
  states: Record<string, State | EndState | null>;
  vars?: Record<string, Schema>;
}
