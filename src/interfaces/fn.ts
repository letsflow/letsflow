export type Fn = FnRef | FnEval | FnTpl;

interface FnRef {
  '<ref>': string;
}

interface FnEval {
  '<eval>': string;
}

interface FnTpl {
  '<tpl>': string;
}
