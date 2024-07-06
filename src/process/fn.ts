import jmespath, { TYPE_ANY, TYPE_BOOLEAN, TYPE_STRING } from '@letsflow/jmespath';
import { Fn } from '../scenario';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';
import stringify from 'fast-json-stable-stringify';
import { v5 as uuidv5, NIL } from 'uuid';

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
    return ref(subject['<ref>'], data);
  }

  if ('<sub>' in subject) {
    return sub(subject['<sub>'], data);
  }

  return Object.fromEntries(Object.entries(subject).map(([key, value]) => [key, applyFn(value, data)]));
}

export function isFn(subject: any): subject is Fn {
  return (
    typeof subject === 'object' &&
    subject !== null &&
    !(subject instanceof Date) &&
    ('<ref>' in subject || '<sub>' in subject)
  );
}

export function ref(expression: string, data: JSONData): any {
  return jmespath.search(data, expression);
}

export function sub(value: string, data: Record<string, any>): string {
  return subApply(value, (expr): string => {
    const value = jmespath.search(data, expr);

    if (typeof value === 'object' && value !== null) {
      throw new Error(`Cannot substitute: expression '${expr}' returned an object`);
    }

    return String(value ?? '');
  });
}

function subApply(input: string, replace: (expr: string) => string): string {
  let output = '';
  let expression = '';
  let dollarSeen = false;
  let bracketCount = 0;
  let isInQuotes = false;

  for (const char of input) {
    if (bracketCount > 0 && (char === "'" || char === '"' || char === '`')) {
      isInQuotes = !isInQuotes;
    }

    if (char === '$' && bracketCount === 0) {
      dollarSeen = true;
      continue;
    }

    if (dollarSeen && char === '{' && !isInQuotes) {
      bracketCount++;
    } else if (bracketCount > 0 && char === '{' && !isInQuotes) {
      bracketCount++;
      expression += char;
    } else if (bracketCount > 1 && char === '}' && !isInQuotes) {
      bracketCount--;
      expression += char;
    } else if (bracketCount === 1 && char === '}' && !isInQuotes) {
      bracketCount--;
      output += replace(expression);
      expression = '';
    } else if (bracketCount > 0) {
      expression += char;
    } else {
      if (dollarSeen) {
        output += '$';
        dollarSeen = false;
      }
      output += char;
    }

    dollarSeen = false;
  }

  if (bracketCount > 0) {
    throw new Error('Invalid expression');
  }

  return output;
}
