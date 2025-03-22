import * as YAML from 'yaml';
import {
  CreateNodeOptions,
  DocumentOptions,
  ParseOptions,
  SchemaOptions,
  ToJSOptions,
  ToStringOptions,
  YAMLMap,
} from 'yaml';
import { stringifyString } from 'yaml/util';
import { clean } from './process/utils';
import { fnSchema } from './schemas/v1.0';

const fnTag = (type: string): YAML.ScalarTag => ({
  identify: (value) => {
    return (
      typeof value === 'object' && value !== null && `<${type}>` in value && typeof value[`<${type}>`] === 'string'
    );
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

const tplExplicitTag: YAML.CollectionTag = {
  tag: '!tpl',
  collection: 'map',
  resolve(map: YAMLMap.Parsed) {
    const tplKey = new YAML.Scalar('<tpl>');
    tplKey.range = [0, 0, 0];

    const wrappedMap = new YAMLMap();
    wrappedMap.range = [0, 0, 0];
    wrappedMap.items.push(new YAML.Pair(tplKey, map) as any);

    return wrappedMap;
  },
};

const constTag: YAML.ScalarTag = {
  tag: '!const',
  resolve: (str) => ({ const: parseValue(str) }),
};

const enumTag: YAML.CollectionTag = {
  tag: '!enum',
  collection: 'seq',
  resolve: (seq) => ({ enum: seq.toJSON() }),
};

const defaultTag: YAML.ScalarTag = {
  tag: '!default',
  resolve(str) {
    const value = parseValue(str);
    return { default: value, ...determineType(value) };
  },
};

const formatTag: YAML.ScalarTag = {
  tag: '!format',
  resolve: (format) => ({ type: 'string', format }),
};

const patternTag: YAML.ScalarTag = {
  tag: '!pattern',
  resolve: (pattern) => ({ type: 'string', pattern }),
};

const requiredScalarTag: YAML.ScalarTag = {
  tag: '!required',
  resolve: (type) => clean({ type: type || undefined, '!required': true }),
};

const requiredMapTag: YAML.CollectionTag = {
  tag: '!required',
  collection: 'map',
  resolve(map: YAMLMap.Parsed) {
    // Create a parsed scalar for the `required` property
    const requiredKey = new YAML.Scalar('!required');
    requiredKey.range = [0, 0, 0];

    const requiredValue = new YAML.Scalar(true);
    requiredValue.range = [0, 0, 0];

    map.items.push(new YAML.Pair(requiredKey, requiredValue) as any);

    return map;
  },
};

const fnScalarTag: YAML.ScalarTag = {
  tag: '!fn',
  resolve: (type) => ({ oneOf: [{ type }, { $ref: fnSchema.$id }] }),
};

const fnMapTag: YAML.CollectionTag = {
  tag: '!fn',
  collection: 'map',
  resolve(map: YAMLMap.Parsed) {
    // Create a new YAML sequence (array)
    const oneOfArray = new YAML.YAMLSeq();
    oneOfArray.items.push(map); // Add the original map
    oneOfArray.items.push(new YAML.Scalar({ $ref: fnSchema.$id })); // Add the schema reference

    // Create a new map with 'oneOf' as the key
    const result = new YAMLMap();
    result.set('oneOf', oneOfArray);

    return result;
  },
};

function parseValue(value: any) {
  const numValue: any = Number(value);
  if (!isNaN(numValue)) {
    return numValue;
  }

  if (value === 'true' || value === 'false') {
    return value === 'true';
  }

  if (value === '~') {
    return null;
  }

  return value;
}

function determineType(value: any): { type?: string; items?: string | string[]; format?: string } {
  if (value === null || value === undefined) {
    return {};
  }

  if (Array.isArray(value)) {
    const items = Array.from(new Set(value.map((v) => determineType(v).type)));
    return items.length === 0 || items.some((t) => t === undefined)
      ? { type: 'array' }
      : { type: 'array', items: items.length === 1 ? (items[0] as string) : (items as string[]) };
  }

  if (value instanceof Date) {
    return { type: 'string', format: 'date-time' };
  }

  if (typeof value === 'number') {
    return { type: Number.isInteger(value) ? 'integer' : 'number' };
  }

  return { type: typeof value };
}

const updateModeFlag = (mode: string): YAML.ScalarTag => ({
  tag: `!${mode}`,
  resolve(str) {
    return { mode, set: str };
  },
});

export const schema = new YAML.Schema({
  customTags: [
    fnTag('ref'),
    fnTag('tpl'),
    tplExplicitTag,
    constTag,
    enumTag,
    formatTag,
    patternTag,
    defaultTag,
    requiredScalarTag,
    requiredMapTag,
    fnScalarTag,
    fnMapTag,
    updateModeFlag('merge'),
    updateModeFlag('append'),
  ],
  merge: true,
});

export function stringify(
  data: any,
  options?: DocumentOptions & SchemaOptions & ParseOptions & CreateNodeOptions & ToStringOptions,
): string {
  return YAML.stringify(data, { schema, ...(options ?? {}) });
}

export function parse(yaml: string, options?: ParseOptions & DocumentOptions & SchemaOptions & ToJSOptions): any {
  return YAML.parse(yaml, { schema, ...(options ?? {}) });
}
