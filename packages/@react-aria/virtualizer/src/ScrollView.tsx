/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import {Rect as IRect} from '@react-types/shared';
import React, {
  CSSProperties,
  ForwardedRef,
  HTMLAttributes,
  ReactNode,
  RefObject,
  useCallback
} from 'react';
import {Rect, Size} from '@react-stately/virtualizer';
import {useScrollView as useAriaScrollView, useObjectRef} from '@react-aria/utils';
import {useLocale} from '@react-aria/i18n';

interface ScrollViewProps extends HTMLAttributes<HTMLElement> {
  contentSize: Size,
  onVisibleRectChange: (rect: Rect) => void,
  children?: ReactNode,
  innerStyle?: CSSProperties,
  onScrollStart?: () => void,
  onScrollEnd?: () => void,
  scrollDirection?: 'horizontal' | 'vertical' | 'both'
}

function ScrollView(props: ScrollViewProps, ref: ForwardedRef<HTMLDivElement | null>) {
  ref = useObjectRef(ref);
  let {scrollViewProps, contentProps} = useScrollView(props, ref);

  return (
    <div role="presentation" {...scrollViewProps} ref={ref}>
      <div {...contentProps}>
        {props.children}
      </div>
    </div>
  );
}

const ScrollViewForwardRef:
  React.ForwardRefExoticComponent<ScrollViewProps & React.RefAttributes<HTMLDivElement | null>> =
React.forwardRef(ScrollView);
export {ScrollViewForwardRef as ScrollView};

interface ScrollViewAria {
  isScrolling: boolean,
  scrollViewProps: HTMLAttributes<HTMLElement>,
  contentProps: HTMLAttributes<HTMLElement>
}

export function useScrollView(props: ScrollViewProps, ref: RefObject<HTMLElement | null>): ScrollViewAria {
  let {onVisibleRectChange: callback} = props;
  let {direction} = useLocale();
  let onVisibleRectChange = useCallback((rect: IRect) => {
    callback(new Rect(rect.x, rect.y, rect.width, rect.height));
  }, [callback]);
  return useAriaScrollView({...props, direction, onVisibleRectChange}, ref);
}
