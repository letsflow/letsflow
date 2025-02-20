export interface Schema {
  $schema?: string;
  $ref?: string;
  type?: string | string[];
  title?: string;
  default?: any;
  description?: string;
  properties?: Record<string, string | Schema>;
  patternProperties?: Record<string, string | Schema>;
  additionalProperties?: boolean | string | Schema;
  required?: string[];
  items?: string | Schema;

  [_: string]: any;
}
