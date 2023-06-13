import { Actor } from './process';

export interface StartInstructions {
  scenario: string;
  actors: Record<string, Omit<Actor, 'title'>>;
  vars: Record<string, any>;
}
