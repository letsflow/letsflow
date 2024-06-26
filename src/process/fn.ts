import jmespath, { TYPE_ANY, TYPE_BOOLEAN } from '@letsflow/jmespath';
import { Fn } from '../scenario';

type JSONData = Parameters<typeof jmespath.search>[0];

jmespath.registerFunction(
  'if',
  ([cond, a, b]) => cond ? a : b,
  [{ types: [TYPE_BOOLEAN] }, { types: [TYPE_ANY] }, { types: [TYPE_ANY], optional: true }],
);

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
  return typeof subject === 'object' && subject !== null && !(subject instanceof Date)
    && ('<ref>' in subject || '<sub>' in subject);
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
