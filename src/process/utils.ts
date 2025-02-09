import { Process } from './interfaces/process';

export function hasEnded(process: Process): boolean {
  return !!process.current.key.match(/^\(.+\)$/);
}

export function chain<T extends Process>(process: T, ...fns: Array<(value: T) => T>): T {
  return fns.reduce((p, fn) => ((p.events[p.events.length - 1] as any).skipped ? p : fn(p)), process);
}

export function clean<T extends Record<any, any>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([_, value]) => value !== undefined)) as T;
}
