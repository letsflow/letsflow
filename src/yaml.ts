import * as YAML from 'yaml';
import { stringifyString } from 'yaml/util';

import {
  DocumentOptions,
  ParseOptions,
  SchemaOptions,
  ToJSOptions,
  CreateNodeOptions,
  ToStringOptions,
} from 'yaml';

const fnTag = (type: string): YAML.ScalarTag => ({
  identify: (value) => {
    return typeof value === 'object' && value !== null && `<${type}>` in value;
  },
  tag: `!${type}`,
  stringify(item: YAML.Scalar<Record<string, string>>, ctx, onComment, onChompKeep) {
    const value = item.value[`<${type}>`];
    return stringifyString({ value }, ctx, onComment, onChompKeep);
  },
  resolve(str) {
    return { [`<${type}>`]: str };
  },
});

function parseValue(value: any) {
  const numValue: any = Number(value);
  if (!isNaN(numValue)) {
    return numValue;
  }

  if (value === 'true' || value === 'false') {
    return value === 'true';
  }

  return value;
}

const constTag: YAML.ScalarTag = {
  tag: '!const',
  resolve(str) {
    return { const: parseValue(str) };
  },
};

const defaultTag: YAML.ScalarTag = {
  tag: '!default',
  resolve(str) {
    const value = parseValue(str);
    return { type: typeof value, default: value };
  },
};

export const schema = new YAML.Schema({
  customTags: [fnTag('ref'), fnTag('sub'), constTag, defaultTag],
});

export function stringify(data: any, options?: DocumentOptions & SchemaOptions & ParseOptions & CreateNodeOptions & ToStringOptions): string {
  return YAML.stringify(data, { schema, ...(options ?? {}) });
}

export function parse(yaml: string, options?: ParseOptions & DocumentOptions & SchemaOptions & ToJSOptions): any {
  return YAML.parse(yaml, { schema, ...(options ?? {}) });
}
