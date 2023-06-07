import * as YAML from 'yaml';
import { CollectionTag, YAMLMap } from 'yaml';

const fnTag = (type: string): CollectionTag => ({
  identify: (value) => typeof value === 'object' && value !== null && `<${type}>` in value,
  tag: `!${type}`,
  collection: 'map',
  resolve: (value: YAMLMap.Parsed) => value[`<${type}>`]
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
