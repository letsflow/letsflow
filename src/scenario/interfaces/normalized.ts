import { Fn } from './fn';
import { EndState, ExplicitState, Schema, UpdateInstruction } from './scenario';

export interface NormalizedAction {
  $schema: string;
  title: string;
  description: string | Fn;
  actor: string[];
  update: UpdateInstruction[];

  [_: string]: any;
}

export interface NormalizedScenario {
  $schema: string;
  title: string;
  description: string;

  actors: Record<string, Schema>;
  actions: Record<string, NormalizedAction>;
  states: Record<string, Required<ExplicitState> | Required<EndState>>;
  vars: Record<string, Schema>;
}
