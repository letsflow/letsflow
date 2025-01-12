import * as YAML from 'yaml';
import {
  CreateNodeOptions,
  DocumentOptions,
  ParseOptions,
  Scalar,
  SchemaOptions,
  ToJSOptions,
  ToStringOptions,
  YAMLMap,
} from 'yaml';
import { stringifyString } from 'yaml/util';

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

const requiredScalarTag: YAML.ScalarTag = {
  tag: '!required',
  resolve(type) {
    return { type, '!required': true };
  },
}
const requiredMapTag: YAML.CollectionTag = {
  tag: '!required',
  collection: 'map',
  resolve(map: YAMLMap.Parsed) {
    const result: Record<string, any> = {};
    for (const item of map.items) {
      const key = item.key instanceof Scalar ? item.key.value : String(item.key);
      const value = item.value instanceof Scalar ? item.value.value : item.value;

      if (key && typeof key === 'string') {
        result[key] = value;
      }
    }

    result['!required'] = true;
    return result;
  },
}

export const schema = new YAML.Schema({
  customTags: [fnTag('ref'), fnTag('sub'), constTag, defaultTag, requiredScalarTag, requiredMapTag],
});

export function stringify(data: any, options?: DocumentOptions & SchemaOptions & ParseOptions & CreateNodeOptions & ToStringOptions): string {
  return YAML.stringify(data, { schema, ...(options ?? {}) });
}

export function parse(yaml: string, options?: ParseOptions & DocumentOptions & SchemaOptions & ToJSOptions): any {
  return YAML.parse(yaml, { schema, ...(options ?? {}) });
}
