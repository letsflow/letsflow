import { Fn } from './fn';
import { EndState, ExplicitState, Schema, UpdateInstruction } from './scenario';

export interface NormalizedAction {
  $schema: string;
  title: string;
  description: string | Fn;
  actor: Array<string | Fn>;
  responseSchema: Schema | Fn;
  update: UpdateInstruction[];

  [_: string]: any;
}

export type NormalizedState = Required<ExplicitState> | Required<EndState>;

export interface NormalizedScenario {
  $schema: string;
  name?: string;
  version?: string;
  title: string;
  description: string;
  tags: string[];

  actors: Record<string, Schema>;
  actions: Record<string, NormalizedAction>;
  states: Record<string, NormalizedState>;
  vars: Record<string, Schema>;

  [_: string]: any;
}
