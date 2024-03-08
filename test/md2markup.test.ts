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

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { Helix } from '@adobe/helix-universal';
import { DEFAULT_CONTEXT, minifyHtml } from './util.js';
import md2markup from '../src/md2markup.js';

// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('md2markup', () => {
  let ctx: Helix.UniversalContext;
  beforeEach(() => {
    ctx = DEFAULT_CONTEXT({ attributes: { content: {} } });
  });

  async function runTest(name: string) {
    ctx.attributes.content.md = await fs.readFile(path.resolve(__dirname, 'fixtures', `${name}.md`), 'utf-8');
    const expected = await fs.readFile(path.resolve(__dirname, 'fixtures', `${name}.html`), 'utf-8');
    const html = md2markup(ctx);
    expect(minifyHtml(html)).to.equal(minifyHtml(expected));
  }

  it('should convert markdown to markup (simple)', async () => {
    await runTest('simple');
  });

  it.skip('should convert markdown to markup (simple-block)', async () => {
    await runTest('simple-block');
  });

  it.skip('should convert markdown to markup (page)', async () => {
    await runTest('page');
  });
});
