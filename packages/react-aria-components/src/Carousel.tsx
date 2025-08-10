/*
 * Copyright 2022 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import {AriaTabListProps, mergeProps, Orientation, useFocusRing} from 'react-aria';
import {CollectionBuilder} from '@react-aria/collections';
import {ContextValue, Provider, RenderProps, SlotProps, useContextProps, useRenderProps} from './utils';
import {filterDOMProps} from '@react-aria/utils';
import {forwardRefType, GlobalDOMAttributes,  RefObject} from '@react-types/shared';
import {Collection as ICollection, Node, useTabListState} from 'react-stately';
import React, {createContext, ForwardedRef, forwardRef, useMemo} from 'react';
import {TabListStateContext, TabsContext} from './Tabs';

export interface CarouselProps extends Omit<AriaTabListProps<any>, 'items' | 'children'>, RenderProps<CarouselRenderProps>, SlotProps, GlobalDOMAttributes<HTMLDivElement> {}

export interface CarouselRenderProps {
  /**
   * The orientation of the carousel.
   * @selector [data-orientation="horizontal | vertical"]
   */
  orientation: Orientation
}

export const CarouselContext = createContext<ContextValue<CarouselProps, HTMLDivElement>>(null);

/**
 * Carousel organize content into multiple sections and allow users to navigate between them.
 */
export const Carousel = /*#__PURE__*/ (forwardRef as forwardRefType)(function Carousel(props: CarouselProps, ref: ForwardedRef<HTMLDivElement>) {
  [props, ref] = useContextProps(props, ref, CarouselContext);
  let {children, orientation = 'horizontal'} = props;
  children = useMemo(() => (
    typeof children === 'function'
      ? children({orientation, defaultChildren: null})
      : children
  ), [children, orientation]);

  return (
    <CollectionBuilder content={children}>
      {collection => <CarouselInner props={props} collection={collection} CarouselRef={ref} />}
    </CollectionBuilder>
  );
});

interface CarouselInnerProps {
  props: CarouselProps,
  collection: ICollection<Node<any>>,
  CarouselRef: RefObject<HTMLDivElement | null>
}

function CarouselInner({props, CarouselRef: ref, collection}: CarouselInnerProps) {
  let {orientation = 'horizontal'} = props;
  let state = useTabListState({
    ...props,
    collection,
    children: undefined
  });
  let {focusProps, isFocused, isFocusVisible} = useFocusRing({within: true});
  let values = useMemo(() => ({
    orientation,
    isFocusWithin: isFocused,
    isFocusVisible
  }), [orientation, isFocused, isFocusVisible]);
  let renderProps = useRenderProps({
    ...props,
    defaultClassName: 'react-aria-Carousel',
    values
  });

  let DOMProps = filterDOMProps(props, {global: true});

  return (
    <div
      {...mergeProps(DOMProps, renderProps, focusProps)}
      ref={ref}
      slot={props.slot || undefined}
      data-focused={isFocused || undefined}
      data-orientation={orientation}
      data-focus-visible={isFocusVisible || undefined}
      data-disabled={state.isDisabled || undefined}>
      <Provider
        values={[
          [TabsContext, props],
          [TabListStateContext, state]
        ]}>
        {renderProps.children}
      </Provider>
    </div>
  );
}
