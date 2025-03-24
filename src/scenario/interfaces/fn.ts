export type Fn = FnRef | FnTpl | FnSelect;

interface FnRef {
  '<ref>': string;
}

interface FnTpl {
  '<tpl>':
    | string
    | {
        template: string;
        view?: Record<string, any>;
        partials?: Record<string, string>;
      };
}

interface FnSelect {
  '<select>': {
    _: string | number | boolean | Fn;
    [option: string]: any;
  };
}

export type ReplaceFn<T> = T extends Fn
  ? never // Remove Fn from the type
  : T extends Array<infer U>
    ? Array<ReplaceFn<U>>
    : T extends Record<string, any>
      ? { [K in keyof T]: ReplaceFn<T[K]> }
      : T;
