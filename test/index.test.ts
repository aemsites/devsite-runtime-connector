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

import { main } from '../src/index.js';
import { OWParams, OWResponse, OW_PARAMS } from './util.js';

const mainFn = main as (params: OWParams) => Promise<OWResponse>;

describe('index', () => {
  it('responds 400 to invalid path', async () => {
    const resp = await mainFn(OW_PARAMS({ suffix: '/invalid' }));
    expect(resp.statusCode).to.equal(400);
    expect(resp.headers['x-error']).to.equal('owner and repo are required');
  });
});
