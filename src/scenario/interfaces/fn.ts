export type Fn = FnRef | FnTpl;

interface FnRef {
  '<ref>': string;
}

interface FnTpl {
  '<tpl>':
    | string
    | {
        template: string;
        view?: any;
        partials?: Record<string, string>;
      };
}

export type ReplaceFn<T> = T extends Fn
  ? never // Remove Fn from the type
  : T extends Array<infer U>
    ? Array<ReplaceFn<U>>
    : T extends Record<string, any>
      ? { [K in keyof T]: ReplaceFn<T[K]> }
      : T;
