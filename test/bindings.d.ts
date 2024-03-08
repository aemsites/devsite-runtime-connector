/* eslint-disable */

import 'chai';
import 'mocha';

declare global {
  export const expect: Chai.ExpectStatic;
  export const assert: Chai.AssertStatic;
}

declare global {
  export namespace NodeJS {
    // Forward declaration for `NodeJS.EventEmitter` from node.d.ts.
    // Required by Mocha.Runnable, Mocha.Runner, and Mocha.Suite.
    // NOTE: Mocha *must not* have a direct dependency on @types/node.
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface EventEmitter { }

    // Augments NodeJS's `global` object when node.d.ts is loaded
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Global extends Mocha.MochaGlobals { }
  }
}

export { };
