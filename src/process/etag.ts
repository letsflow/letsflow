import { Index } from './interfaces';

export function etag(process: Index) {
  if ((process.events ?? []).length === 0) throw new Error('Process has no events');
  return process.events[process.events.length - 1].hash;
}

export function lastModified(process: Index) {
  if ((process.events ?? []).length === 0) throw new Error('Process has no events');
  return process.events[process.events.length - 1].timestamp.toUTCString();
}
