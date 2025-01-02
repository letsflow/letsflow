import { Fn } from './fn';
import { ActorSchema, EndState, ExplicitState, Schema, UpdateInstruction } from './scenario';

export interface NormalizedAction {
  $schema: string;
  title: string;
  description: string | Fn;
  actor: Array<string | Fn>;
  responseSchema: Schema | Fn;
  update: UpdateInstruction[];

  [_: string]: any;
}

interface NormalizedExplicitTransition {
  on: string;
  by: string[];
  if: boolean | Fn;
  goto: string | null;
}

interface NormalizedTimeoutTransition {
  after: string;
  if: boolean | Fn;
  goto: string | null;
}

export type NormalizedTransition = NormalizedExplicitTransition | NormalizedTimeoutTransition;

export type NormalizedState =
  | Required<Omit<ExplicitState, 'transitions'> & { transitions: NormalizedTransition[] }>
  | Required<EndState>;

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
