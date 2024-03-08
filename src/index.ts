/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import type { Helix } from '@adobe/helix-universal';
import wrap from '@adobe/helix-shared-wrap';
import { Request, Response } from '@adobe/fetch';
import testmd from './testmd.js';
// eslint-disable-next-line
import { createAdapter } from '../node_modules/@adobe/helix-universal/src/openwhisk-adapter.js';
import md2markup from './md2markup.js';

// exported for dev server
export async function run(req: Request, ctx: Helix.UniversalContext): Promise<Response> {
  ctx.attributes ??= {};
  ctx.attributes.content ??= {
    md: testmd,
  };

  const html = md2markup(ctx);
  // try {
  // } catch (e) {
  //   return new Response((e as Error).message,
  // { status: 500, headers: { 'content-type': 'text/plain' } });
  // }
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html' } });
}

// eslint-disable-next-line
export const main = (wrap as any)(createAdapter({ factory: () => run }));
