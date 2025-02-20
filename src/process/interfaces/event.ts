export interface InstantiateEvent {
  id: string;
  timestamp: Date;
  scenario: string;
  hash: string;
}

export interface ActionEvent {
  previous: string;
  timestamp: Date;
  action: string;
  actor: { key: string; id?: string; [_: string]: any };
  response?: any;
  skipped: boolean;
  errors?: string[];
  hash: string;
}

export interface TimeoutEvent {
  previous: string;
  timestamp: Date;
  hash: string;
}

export type Event = InstantiateEvent | ActionEvent | TimeoutEvent;
