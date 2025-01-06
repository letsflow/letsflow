import { Fn } from './fn';

type Forbidden<T, K extends keyof any> = {
  [P in keyof T]: P extends K ? never : T[P];
} & {
  [P in K]?: never;
};

export interface Schema {
  $ref?: string;
  type?: string;
  title?: string;
  default?: any;
  description?: string;
  properties?: Record<string, string | Schema>;
  required?: string[];
  items?: string | Schema;
  additionalProperties?: boolean | string | Schema;
}

export interface ActorSchema extends Schema {
  role?: string | string[];
}

export interface Action {
  $schema?: string;
  title?: string;
  description?: string | Fn;
  actor?: string | Fn | Array<string | Fn>;
  responseSchema?: string | Schema | Fn;
  if?: boolean | Fn;
  update?: string | UpdateInstruction | UpdateInstruction[];

  [_: string]: any;
}

export interface UpdateInstruction {
  set: string | Fn;
  data?: any | Fn;
  merge?: boolean;
  if?: boolean | Fn;
}

export type State = ExplicitState | SimpleState | SimpleTimeoutState;

interface BaseState {
  title?: string | Fn;
  description?: string | Fn;
  instructions?: Record<string, string | Fn>;
  actions?: string[];
  notify?: string | Notify | Array<string | Notify>;

  [_: string]: any;
}

interface SimpleState extends BaseState {
  on: string;
  by?: string | string[];
  goto: string;
}

interface SimpleTimeoutState extends BaseState {
  after: string | number;
  goto: string;
}

export interface ExplicitState extends BaseState {
  transitions: Array<Transition>;
}

export type EndState = Forbidden<BaseState, 'actions' | 'transitions' | 'on' | 'after' | 'goto'>;

export type Transition = ActionTransition | TimeoutTransition;

interface ActionTransition {
  on: string;
  by?: string | string[];
  if?: boolean | Fn;
  goto: string | null;
}

interface TimeoutTransition {
  after: string | number;
  if?: boolean | Fn;
  goto: string;
}

export interface Notify {
  service: string;
  after?: string | number;
  if?: boolean | Fn;
  trigger?: string | Fn;
  message?: string | Fn | Record<string, any>;
}

export interface Scenario {
  $schema?: string;
  name?: string;
  version?: string;
  title?: string;
  description?: string;
  tags?: string[];

  actors?: Record<string, ActorSchema | null>;
  actions?: Record<string, Action | null>;
  states: Record<string, State | EndState | null>;

  vars?: Record<string, string | Schema>;
  result?: string | Schema;

  [_: string]: any;
}
