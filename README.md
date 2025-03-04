![letsflow](https://github.com/letsflow/workflow-engine/assets/100821/3852a14e-90f8-4f8f-a334-09516f43bbc1)
[![CI](https://github.com/letsflow/letsflow/actions/workflows/main.yml/badge.svg)](https://github.com/letsflow/letsflow/actions/workflows/main.yml)

Letsflow is a human-centric workflow automation engine that blends automation with human decision-making, enabling dynamic interactions between people and automated steps.

```yaml
actors:
  user:
    title: The user
    properties:
      feeling: !default sad

actions:
  complete:
    title: Complete the process
    update:
      set: actors.user.feeling
      value: happy

states:
  initial:
    on: complete
    goto: (done)
```

The *scenario* models a *process* as a fine-state machine. The *actors* are persons, organizations, or systems that can participate in the process by performing *actions*. Which actions can be performed depends on the current *state* of the process. By executing an action, the process can *transition* to a different state.

### [Read the documentation](https://www.letsflow.io/)

## Installation

```bash
yarn add @letsflow/core
```

## Example usage

```typescript
import { normalize } from '@letsflow/core/scenario';
import { chain, instantiate, step } from '@letsflow/core/process';

const scenario = normalize({
  title: 'My first scenario',
  actors: {
    user: {
      title: 'The user',
      properties: {
        feeling: {
          type: 'string',
          default: 'sad'
        }
      }
    }
  },
  actions: {
    complete: {
      title: 'Complete the process',
      update: {
        set: 'actors.user.feeling',
        value: 'happy'
      }
    }
  },
  states: {
    initial: {
      on: 'complete',
      goto: '(done)'
    }
  }
});

const process = chain(
  instantiate(scenario),
  (process) => step(process, 'complete', 'user')
);

console.log(process.current.key); // (done)
console.log(process.actors.user.feeling); // happy
```

