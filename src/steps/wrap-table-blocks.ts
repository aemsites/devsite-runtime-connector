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
import { CONTINUE, SKIP, visit } from 'unist-util-visit';

export default function wrapTableBlocks(ctx: Helix.UniversalContext) {
  const { attributes: { content: { mdast } } } = ctx;

  visit(mdast, (node) => {
    if (node.type !== 'table') {
      return CONTINUE;
    }
    const [first] = node.children;
    if (!first) {
      return CONTINUE;
    }

    node.children.unshift({
      type: 'tableRow',
      children: [{
        type: 'tableCell',
        children: [{
          type: 'text',
          value: 'Table', // block name
        }],
      }],
    });

    return SKIP;
  });
}
