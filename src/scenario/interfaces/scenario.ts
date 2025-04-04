import { Fn } from './fn';
import { Schema } from './schema';

type Forbidden<T, K extends keyof any> = {
  [P in keyof T]: P extends K ? never : T[P];
} & {
  [_ in K]?: never;
};

export interface ActorSchema extends Schema {
  role?: string | string[];
}

export interface Action {
  schema?: string;
  title?: string;
  description?: string | Fn;
  actor?: string | Fn | Array<string | Fn>;
  response?: string | Schema;
  if?: boolean | Fn;
  update?: string | UpdateInstruction | UpdateInstruction[];

  [_: string]: any;
}

export interface UpdateInstruction {
  set: string | Fn;
  value?: any | Fn;
  stub?: any | Fn;
  mode?: 'replace' | 'merge' | 'append';
  if?: boolean | Fn;
}

export interface Log {
  title?: string | Fn;
  description?: string | Fn;
  if?: boolean | Fn;

  [_: string]: any;
}

interface BaseState {
  schema?: string;
  title?: string | Fn;
  description?: string | Fn;
  instructions?: Record<string, string | Fn>;
  notify?: string | Notify | Array<string | Notify>;

  [_: string]: any;
}

interface SimpleState extends BaseState {
  on: string | null;
  by?: string | string[];
  goto: string | null;
  log?: Log | false;
}

interface SimpleTimeoutState extends BaseState {
  after: string | number;
  goto: string;
  log?: Log | false;
}

export interface ExplicitState extends BaseState {
  transitions: Array<Transition>;
}

export type State = ExplicitState | SimpleState | SimpleTimeoutState;
export type EndState = Forbidden<BaseState, 'transitions' | 'on' | 'after' | 'goto'> & { tag?: string | string[] };

export interface ActionTransition {
  on: string | null;
  by?: string | string[];
  if?: boolean | Fn;
  goto: string | null;
  log?: Log | false;
}

export interface TimeoutTransition {
  after: string | number;
  if?: boolean | Fn;
  goto: string;
  log?: Log | false;
}

export type Transition = ActionTransition | TimeoutTransition;

export interface Notify {
  service: string;
  after?: string | number;
  if?: boolean | Fn;
  trigger?: string | null | Fn;
  message?: string | Fn | { schema?: string; [_: string]: any };
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
