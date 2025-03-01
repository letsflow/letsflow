import { Action } from './process';

export interface StandardMessage {
  actions: Action[];
  instructions?: string;
}
