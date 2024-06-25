import { Action, Actor } from './process';

export interface Message {
  process: string;
  scenario: string;
  action: Omit<Action, 'actors'> & { key: string };
  actor: Actor;
  timestamp: Date;
  etag: string;
}
