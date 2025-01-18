import { Process } from './interfaces/process';

export function hasEnded(process: Process): boolean {
  return !!process.current.key.match(/^\(.+\)$/);
}

export function clean<T extends Record<any, any>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([_, value]) => value !== undefined)) as T;
}
