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

/* eslint-disable @typescript-eslint/no-unsafe-assignment,
                  @typescript-eslint/no-unsafe-call,
                  @typescript-eslint/no-unsafe-member-access */

import { DevelopmentServer } from '@adobe/helix-universal-devserver';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { run } from '../../src/index.js';

// eslint-disable-next-line no-underscore-dangle
global.__rootdir = resolve(fileURLToPath(import.meta.url), '..', '..', '..');

async function init() {
  const devServer = await new DevelopmentServer(run).init();
  await devServer.start();
}

init().catch((e) => process.stderr.write(`${e}\n`));
