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

import CornerTriangle_L from './S2_CornerTriangleSize200.svg';
import CornerTriangle_M from './S2_CornerTriangleSize100.svg';
import CornerTriangle_S from './S2_CornerTriangleSize75.svg';
import CornerTriangle_XL from './S2_CornerTriangleSize300.svg';
import {ReactNode, SVGProps} from 'react';
import {style} from '../style' with {type: 'macro'};

let styles = style({
  width: {
    size: {
      M: 5,
      L: 6,
      XL: 7,
      S: 5
    }
  },
  height: {
    size: {
      M: 5,
      L: 6,
      XL: 7,
      S: 5
    }
  }
});

export default function CornerTriangle(props: SVGProps<SVGSVGElement> & {size?: 'M' | 'L' | 'XL' | 'S'}): ReactNode {
  let {size = 'M', ...otherProps} = props;
  switch (size) {
    case 'M':
      return <CornerTriangle_M {...otherProps} className={(otherProps.className || '') + styles({size})} />;
    case 'L':
      return <CornerTriangle_L {...otherProps} className={(otherProps.className || '') + styles({size})} />;
    case 'XL':
      return <CornerTriangle_XL {...otherProps} className={(otherProps.className || '') + styles({size})} />;
    case 'S':
      return <CornerTriangle_S {...otherProps} className={(otherProps.className || '') + styles({size})} />;
  }
}
