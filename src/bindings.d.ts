import { OWEnv } from './types';

// declare global {
//   export interface Process {
//     env: OWEnv & Record<string, string>;
//   }
// }

declare global {
  namespace NodeJS {
    interface ProcessEnv extends OWEnv { }
  }
}