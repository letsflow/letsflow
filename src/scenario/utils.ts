import { Fn } from './interfaces';

export function isFn(subject: any): subject is Fn {
  return (
    typeof subject === 'object' &&
    subject !== null &&
    !(subject instanceof Date) &&
    !Array.isArray(subject) &&
    ('<ref>' in subject || '<tpl>' in subject)
  );
}
