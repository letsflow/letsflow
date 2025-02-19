import { ActionEvent, Event, Index, InstantiateEvent, TimeoutEvent } from './interfaces';

export function hasEnded(process: Index): boolean {
  return !!process.current.key.match(/^\(.+\)$/);
}

export function chain<T extends Index>(process: T, ...fns: Array<(value: T) => T>): T {
  return fns.reduce((p, fn) => ((p.events[p.events.length - 1] as any).skipped ? p : fn(p)), process);
}

export function clean<T extends Record<any, any>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([_, value]) => value !== undefined)) as T;
}

export function isInstantiateEvent(event: Event): event is InstantiateEvent {
  return 'scenario' in event;
}

export function isActionEvent(event: Event): event is ActionEvent {
  return 'action' in event;
}

export function isTimeoutEvent(event: Event): event is TimeoutEvent {
  return !('scenario' in event) && !('action' in event);
}
