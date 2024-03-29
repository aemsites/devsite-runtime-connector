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

export interface OWParams {
  __ow_method: string;
  __ow_headers: Record<string, string>;
  __ow_path: string;
  __ow_body: string;
  __ow_query: string;
}

export interface OWResponse {
  statusCode: number;
  body: string;
  headers: Record<string, string>;
  error?: string;
}

export const DEFAULT_CONTEXT = (
  overrides: Record<string, unknown> = {},
): Helix.UniversalContext => {
  return {
    pathInfo: {
      suffix: '',
    },
    attributes: {},
    ...overrides,
  } as unknown as Helix.UniversalContext;
};

export const OW_PARAMS = (
  overrides: {
    method?: string;
    headers?: Record<string, string>;
    suffix?: string;
    rawBody?: string;
    query?: string;
  } = {},
): OWParams => {
  return {
    __ow_method: overrides.method || 'GET',
    __ow_headers: overrides.headers || {},
    __ow_path: overrides.suffix || '',
    __ow_body: overrides.rawBody || '',
    __ow_query: overrides.query || '',
  };
};

export function minifyHtml(html: string, mainOnly = true): string {
  let input = html;
  if (mainOnly) {
    input = html.includes('<main>') ? html.split('<main>')[1] : html;
    [input] = input.split('</main>');
  }

  return input
    .replace(/\n/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+<\/p>/g, '</p>')
    .trim();
}
