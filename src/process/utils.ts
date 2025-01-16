import { Process } from './interfaces/process';

export function hasEnded(process: Process): boolean {
  return !!process.current.key.match(/^\(.+\)$/);
}

export function isPlainObject(value: any): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}
