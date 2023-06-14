import jmespath from '@letsflow/jmespath';

export function ref(expression, data) {
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
