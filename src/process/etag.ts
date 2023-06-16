import { Process } from './interfaces/process';

export function etag(process: Process) {
  return process.events[process.events.length - 1].hash;
}

export function lastModified(process: Process) {
  return process.events[process.events.length - 1].timestamp.toUTCString();
}
