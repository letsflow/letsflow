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
