export type Fn = FnRef | FnSub;

interface FnRef {
  '<ref>': string;
}

interface FnSub {
  '<tpl>': string;
}
