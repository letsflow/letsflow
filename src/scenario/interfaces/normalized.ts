import { Fn } from './fn';
import { ActorSchema, EndState, ExplicitState, Log, UpdateInstruction } from './scenario';
import { Schema } from './schema';

export interface NormalizedAction {
  $schema: string;
  title: string;
  description: string | Fn;
  actor: Array<string | Fn> | Fn;
  response: Schema;
  update: Array<Required<UpdateInstruction>>;

  [_: string]: any;
}

export interface NormalizedExplicitTransition {
  on: string;
  by: string[];
  if: boolean | Fn;
  goto: string | null;
  log: Required<Log>;
}

interface NormalizedTimeoutTransition {
  after: number;
  if: boolean | Fn;
  goto: string | null;
  log: Required<Log>;
}

export interface NormalizedNotify {
  service: string;
  after: number;
  if: boolean | Fn;
  trigger?: string | Fn;
  message?: string | Fn | Record<string, any>;
}

export type NormalizedTransition = NormalizedExplicitTransition | NormalizedTimeoutTransition;

export type NormalizedState =
  | (Required<Omit<ExplicitState, 'transitions' | 'notify'>> & {
      transitions: NormalizedTransition[];
      notify: NormalizedNotify[];
    })
  | (Required<Omit<EndState, 'notify'>> & { notify: Array<Omit<NormalizedNotify, 'trigger'>> });

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
