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

import type { Root as MDastRoot } from 'mdast';
import type { Nodes as HastNodes } from 'hast';

export interface Content {
  md?: string;
  mdast?: MDastRoot;
  hast?: HastNodes;
  html?: string;
  root?: string;
  path?: string;
  owner?: string;
  repo?: string;
  gatsbyConfig?: string;
  gatsbyConfigJSon?: string;
}

declare module 'mdast' {
  interface RootContentMap {
    section: {
      type: 'section';
      children: RootContent[];
    }
  }
}

declare module '@adobe/helix-universal' {
  namespace Helix {
    export interface UniversalContext {
      data: Record<string, unknown>;
      attributes: {
        content?: Content;
      }
    }
  }
}
