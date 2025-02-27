import { Action } from './process';

export interface StandardMessage {
  process: string;
  actions: Action[];
  instructions?: string;
  etag: string;
}
