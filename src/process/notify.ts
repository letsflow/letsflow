import { isFn } from '../scenario/utils';
import { applyFn } from './fn';
import { Process, StandardMessage } from './interfaces';
import { clean } from './utils';

export function createMessage(process: Process, service: string): StandardMessage {
  service = service.replace('service:', '');

  const actions = process.current.actions.filter((a) => a.actor.includes(`service:${service}`));
  const instructions = process.current.instructions[`service:${service}`];

  return clean({ actions, instructions });
}

export function determineTrigger(process: Process, service: string, response?: any) {
  service = service.replace('service:', '');

  const state = process.scenario.states[process.current.key];
  const notify = state.notify.find((notify) => notify.service === service);

  if (!isFn(notify?.trigger)) return notify?.trigger ?? null;

  return applyFn(notify.trigger, {
    ...process,
    current: { ...process.current, response, actor: { key: `service:${service}` } },
  });
}
