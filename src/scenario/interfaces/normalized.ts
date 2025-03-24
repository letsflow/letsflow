import { Fn } from './fn';
import { ActorSchema, EndState, ExplicitState, Log, UpdateInstruction } from './scenario';
import { Schema } from './schema';

export interface NormalizedAction {
  schema?: string;
  title: string;
  description: string | Fn;
  actor: Array<string | Fn> | Fn;
  response: Schema;
  update: Array<Required<UpdateInstruction>>;

  [_: string]: any;
}

export interface NormalizedExplicitTransition {
  on: string | null;
  by: string[];
  if: boolean | Fn;
  goto: string | null;
  log: Required<Log>;
}

export interface NormalizedTimeoutTransition {
  after: number;
  if: boolean | Fn;
  goto: string | null;
  log: Required<Log>;
}

export interface NormalizedNotify {
  service: string;
  after: number;
  if: boolean | Fn;
  trigger: string | Fn | null;
  message?: string | Fn | { schema?: string; [_: string]: any };
}

export type NormalizedTransition = NormalizedExplicitTransition | NormalizedTimeoutTransition;

type NormalizedActiveState = Required<Omit<ExplicitState, 'schema' | 'transitions' | 'notify'>> & {
  schema?: string;
  transitions: NormalizedTransition[];
  notify: NormalizedNotify[];
};

type NormalizedEndState = Required<Omit<EndState, 'schema' | 'notify' | 'tag'>> & {
  schema?: string;
  notify: NormalizedNotify[];
  tag: string[];
};

export type NormalizedState = NormalizedActiveState | NormalizedEndState;

export interface NormalizedScenario {
  $schema: string;
  name?: string;
  version?: string;
  title: string;
  description: string;
  tags: string[];

  actors: Record<string, ActorSchema>;
  actions: Record<string, NormalizedAction>;
  states: Record<string, NormalizedState>;
  vars: Record<string, Schema>;
  result: Schema;

  [_: string]: any;
}
