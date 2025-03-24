import jmespath from '@letsflow/jmespath';
import { render } from 'mustache';
import { Fn, ReplaceFn } from './scenario/interfaces/fn';

type JSONData = Parameters<typeof jmespath.search>[0];

export function applyFn<T>(subject: T, data: Record<string, any>): ReplaceFn<T>;
export function applyFn(subject: Fn, data: Record<string, any>): any;
export function applyFn(subject: any, data: Record<string, any>): any {
  if (typeof subject !== 'object' || subject === null || subject instanceof Date) {
    return subject;
  }

  if (Array.isArray(subject)) {
    return subject.map((item) => applyFn(item, data));
  }

  if ('<ref>' in subject) {
    return typeof subject['<ref>'] === 'string' ? ref(subject['<ref>'], data) : undefined;
  }

  if ('<tpl>' in subject) {
    if (typeof subject['<tpl>'] === 'string') {
      return tpl(subject['<tpl>'], data);
    }
    if (typeof subject['<tpl>'] === 'object' && 'template' in subject['<tpl>']) {
      return tpl(
        applyFn(subject['<tpl>'].template, data),
        applyFn(subject['<tpl>'].view, data) ?? data,
        applyFn(subject['<tpl>'].partials, data),
      );
    }
    return undefined;
  }

  if ('<select>' in subject) {
    const { $: on, '*': defaultValue, ...options } = applyFn(subject['<select>'], data);
    return select(on, options, defaultValue);
  }

  return Object.fromEntries(Object.entries(subject).map(([key, value]) => [key, applyFn(value, data)]));
}

export function removeFn<T>(subject: T): ReplaceFn<T>;
export function removeFn(subject: Fn): any;
export function removeFn(subject: any): any {
  if (typeof subject !== 'object' || subject === null || subject instanceof Date) {
    return subject;
  }

  if (Array.isArray(subject)) {
    return subject.map((item) => removeFn(item));
  }

  if ('<ref>' in subject) {
    return undefined;
  }

  if ('<tpl>' in subject) {
    return undefined;
  }

  if ('<select>' in subject) {
    return undefined;
  }

  return Object.fromEntries(Object.entries(subject).map(([key, value]) => [key, removeFn(value)]));
}

export function ref(expression: string, data: JSONData): any {
  try {
    return jmespath.search(data, expression);
  } catch (e) {
    throw new Error(`Failed to evaluate JMESPath expression: ${expression}. ${e.message}`);
  }
}

export function tpl(template: string, view: Record<string, any>, partials?: Record<string, string>): string {
  return render(template, view, partials, { escape: (v) => v });
}

export function select(on: string | number | boolean, options: Record<string, any>, defaultValue: any = null): any {
  if (typeof on === 'boolean') {
    on = on ? 'true' : 'false';
  } else if (typeof on === 'number') {
    on = on.toString();
  }

  return options[on] ?? defaultValue;
}
