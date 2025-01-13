export type Fn = FnRef | FnSub;

interface FnRef {
  '<ref>': string;
}

interface FnSub {
  '<tpl>': string | {
    template: string;
    view?: any;
    partials?: Record<string, string>;
  };
}
