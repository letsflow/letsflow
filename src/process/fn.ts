import jmespath from '@letsflow/jmespath';
import { render } from 'mustache';
import { Fn } from '../scenario';

type JSONData = Parameters<typeof jmespath.search>[0];

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

  return Object.fromEntries(Object.entries(subject).map(([key, value]) => [key, applyFn(value, data)]));
}

export function isFn(subject: any): subject is Fn {
  return (
    typeof subject === 'object' &&
    subject !== null &&
    !(subject instanceof Date) &&
    !Array.isArray(subject) &&
    ('<ref>' in subject || '<tpl>' in subject)
  );
}

export function ref(expression: string, data: JSONData): any {
  return jmespath.search(data, expression);
}

export function tpl(template: string, view: Record<string, any>, partials?: Record<string, string>): string {
  return render(template, view, partials, { escape: (v) => v });
}
