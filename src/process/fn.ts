import jmespath, { TYPE_ANY, TYPE_BOOLEAN, TYPE_STRING } from '@letsflow/jmespath';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import stringify from 'fast-json-stable-stringify';
import { render } from 'mustache';
import { NIL, v5 as uuidv5 } from 'uuid';
import { Fn } from '../scenario';

type JSONData = Parameters<typeof jmespath.search>[0];

jmespath.registerFunction('if', ([cond, a, b]: [boolean, any, any?]) => (cond ? a : b), [
  { types: [TYPE_BOOLEAN] },
  { types: [TYPE_ANY] },
  { types: [TYPE_ANY], optional: true },
]);

jmespath.registerFunction('json_serialize', ([val]: [any]) => stringify(val), [{ types: [TYPE_ANY] }]);
jmespath.registerFunction('json_parse', ([val]: [string]) => JSON.parse(val), [{ types: [TYPE_STRING] }]);

jmespath.registerFunction('sha256', ([val]: [string]) => bytesToHex(sha256(val)), [{ types: [TYPE_STRING] }]);
jmespath.registerFunction('uuidv5', ([val, ns]: [string, string | undefined]) => uuidv5(val, ns ?? NIL), [
  { types: [TYPE_STRING] },
  { types: [TYPE_STRING], optional: true },
]);

jmespath.registerFunction('re_test', ([regexp, val]: [string, string]) => parseRegexString(regexp).test(val), [
  { types: [TYPE_STRING] },
  { types: [TYPE_STRING] },
]);
jmespath.registerFunction('re_match', ([regexp, val]: [string, string]) => val.match(parseRegexString(regexp)), [
  { types: [TYPE_STRING] },
  { types: [TYPE_STRING] },
]);
jmespath.registerFunction(
  're_match_all',
  ([regexp, val]: [string, string]) => Array.from(val.matchAll(parseRegexString(regexp))),
  [{ types: [TYPE_STRING] }, { types: [TYPE_STRING] }],
);
jmespath.registerFunction(
  're_replace',
  ([regexp, val, repl]: [string, string, string]) => val.replace(parseRegexString(regexp), repl),
  [{ types: [TYPE_STRING] }, { types: [TYPE_STRING] }, { types: [TYPE_STRING] }],
);

function parseRegexString(regexString: string): RegExp {
  // Match the pattern between slashes and any flags after the last slash
  const match = regexString.match(/^\/(.*?)\/([gimsuy]*)$/);
  if (!match) {
    throw new Error('Invalid regex string format');
  }
  return new RegExp(match[1], match[2]);
}

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
      return tpl(subject['<tpl>'].template, subject['<tpl>'].data ?? data);
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

export function tpl(value: string, data: Record<string, any>): string {
  return render(value, data, undefined, { escape: (v) => v });
}
