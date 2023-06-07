import * as YAML from 'yaml';
import { Scalar, ScalarTag } from 'yaml';
import { stringifyString } from 'yaml/util'

const fnTag = (type: string): ScalarTag => ({
  identify: (value) => {
    return typeof value === 'object' && value !== null && `<${type}>` in value;
  },
  tag: `!${type}`,
  stringify(item: Scalar<Record<string, string>>, ctx, onComment, onChompKeep) {
    const value = item.value[`<${type}>`];
    return stringifyString({ value }, ctx, onComment, onChompKeep);
  },
  resolve(str) {
    return { [`<${type}>`]: str };
  }
});

export const schema = new YAML.Schema({
  customTags: [ fnTag('ref'), fnTag('eval'), fnTag('tpl') ],
});

export function parse(yaml: string): any {
  return YAML.parse(yaml, { schema });
}

export function stringify(data: any): string {
  return YAML.stringify(data, { schema });
}
