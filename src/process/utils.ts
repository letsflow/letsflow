import { Process } from './interfaces/process';

export function hasEnded(process: Process): boolean {
  return !!process.current.key.match(/^\(.+\)$/);
}
