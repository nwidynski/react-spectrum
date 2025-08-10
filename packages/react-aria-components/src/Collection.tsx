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
import {CollectionBase, Direction, DropTargetDelegate, GlobalDOMAttributes, ItemDropTarget, Key, KeyboardDelegate, LayoutDelegate, Orientation, Rect, RefObject} from '@react-types/shared';
import {createBranchComponent, useCachedChildren} from '@react-aria/collections';
import {DOMLayoutDelegate} from '@react-aria/selection';
import {getScrollPort, getSnapArea, useObjectRef} from '@react-aria/utils';
import {Collection as ICollection, Node, SelectionBehavior, SelectionMode, SectionProps as SharedSectionProps} from 'react-stately';
import React, {cloneElement, createContext, ForwardedRef, HTMLAttributes, isValidElement, JSX, ReactElement, ReactNode, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {StyleProps} from './utils';

export interface CollectionProps<T> extends Omit<CollectionBase<T>, 'children'> {
  /** The contents of the collection. */
  children?: ReactNode | ((item: T) => ReactNode),
  /** Values that should invalidate the item cache when using dynamic collections. */
  dependencies?: ReadonlyArray<any>
}

export interface ItemRenderProps {
  /**
   * Whether the item is currently hovered with a mouse.
   * @selector [data-hovered]
   */
  isHovered: boolean,
  /**
   * Whether the item is currently in a pressed state.
   * @selector [data-pressed]
   */
  isPressed: boolean,
  /**
   * Whether the item is currently selected.
   * @selector [data-selected]
   */
  isSelected: boolean,
  /**
   * Whether the item is currently focused.
   * @selector [data-focused]
   */
  isFocused: boolean,
  /**
   * Whether the item is currently keyboard focused.
   * @selector [data-focus-visible]
   */
  isFocusVisible: boolean,
  /**
   * Whether the item is non-interactive, i.e. both selection and actions are disabled and the item may
   * not be focused. Dependent on `disabledKeys` and `disabledBehavior`.
   * @selector [data-disabled]
   */
  isDisabled: boolean,
  /**
   * The type of selection that is allowed in the collection.
   * @selector [data-selection-mode="single | multiple"]
   */
  selectionMode: SelectionMode,
  /** The selection behavior for the collection. */
  selectionBehavior: SelectionBehavior,
  /**
   * Whether the item allows dragging.
   * @note This property is only available in collection components that support drag and drop.
   * @selector [data-allows-dragging]
   */
  allowsDragging?: boolean,
  /**
   * Whether the item is currently being dragged.
   * @note This property is only available in collection components that support drag and drop.
   * @selector [data-dragging]
   */
  isDragging?: boolean,
  /**
   * Whether the item is currently an active drop target.
   * @note This property is only available in collection components that support drag and drop.
   * @selector [data-drop-target]
   */
  isDropTarget?: boolean
}

export interface SectionProps<T> extends Omit<SharedSectionProps<T>, 'children' | 'title'>, StyleProps, GlobalDOMAttributes<HTMLElement> {
  /** The unique id of the section. */
  id?: Key,
  /** The object value that this section represents. When using dynamic collections, this is set automatically. */
  value?: T,
  /** Static child items or a function to render children. */
  children?: ReactNode | ((item: T) => ReactElement),
  /** Values that should invalidate the item cache when using dynamic collections. */
  dependencies?: ReadonlyArray<any>
}

interface SectionContextValue {
  name: string,
  render: (props: SectionProps<any>, ref: ForwardedRef<HTMLElement>, section: Node<any>, className?: string) => ReactElement
}

export const SectionContext = createContext<SectionContextValue | null>(null);

/** @deprecated */
export const Section = /*#__PURE__*/ createBranchComponent('section', <T extends object>(props: SectionProps<T>, ref: ForwardedRef<HTMLElement>, section: Node<T>): JSX.Element => {
  let {name, render} = useContext(SectionContext)!;
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`<Section> is deprecated. Please use <${name}> instead.`);
  }
  return render(props, ref, section, 'react-aria-Section');
});

export interface CollectionNodeProps<T = Node<unknown>> {
  /** The collection of items to render. */
  collection: ICollection<Node<unknown>>,
  /** The node of the item to render. */
  node: T,
  /** The parent node of the item to render. */
  parent: T | null,
  /** The content that should be rendered before the item. */
  before?: ReactNode,
  /** The content that should be rendered after the item. */
  after?: ReactNode,
  /** A ref to the item to render. */
  itemRef?: ForwardedRef<HTMLElement>
}

export interface CollectionBranchProps extends HTMLAttributes<HTMLElement> {
  /** The collection of items to render. */
  collection: ICollection<Node<unknown>>,
  /** The parent node of the items to render. */
  parent: Node<unknown>,
  /** A function that renders a drop indicator between items. */
  renderDropIndicator?: (target: ItemDropTarget) => ReactNode
}

export interface CollectionRootProps extends HTMLAttributes<HTMLElement> {
  /** The collection of items to render. */
  collection: ICollection<Node<unknown>>,
  /** A set of keys for items that should always be persisted in the DOM. */
  persistedKeys?: Set<Key> | null,
  /** A ref to the scroll container for the collection. */
  scrollRef?: RefObject<HTMLElement | null>,
  /** A delegate object that provides scroll information for the collection. */
  scrollDelegate?: ScrollDelegate,
  /** A function that renders a drop indicator between items. */
  renderDropIndicator?: (target: ItemDropTarget) => ReactNode
}

export interface CollectionRenderer<T = Node<unknown>> {
  /** Whether this is a virtualized collection. */
  isVirtualized?: boolean,
  /** A delegate object that provides layout information for items in the collection. */
  layoutDelegate?: LayoutDelegate,
  /** A delegate object that provides drop targets for pointer coordinates within the collection. */
  dropTargetDelegate?: DropTargetDelegate,
  /** A component that renders the root collection items. */
  CollectionRoot: React.ComponentType<CollectionRootProps>,
   /** A component that renders the child collection items. */
  CollectionBranch: React.ComponentType<CollectionBranchProps>,
  /** A component that renders the collection item. */
  CollectionNode?: React.ComponentType<CollectionNodeProps<T>>
}

interface DefaultRenderer extends CollectionRenderer<Node<unknown>> {
  /** A component that renders the collection item. */
  CollectionNode: React.ComponentType<CollectionNodeProps<Node<unknown>>>
}

export const DefaultCollectionRenderer: DefaultRenderer = {
  CollectionRoot({collection, renderDropIndicator, scrollRef}) {
    let ref = useObjectRef(scrollRef);
    useScrollDelegate({collection, ref});
    return useCollectionRender(collection, null, renderDropIndicator);
  },
  CollectionBranch({collection, parent, renderDropIndicator}) {
    return useCollectionRender(collection, parent, renderDropIndicator);
  },
  CollectionNode({node, before, after, itemRef}) {
    return <>{before}{node.render!(node, itemRef)}{after}</>;
  }
};

function useCollectionRender(
  collection: ICollection<Node<unknown>>,
  parent: Node<unknown> | null,
  renderDropIndicator?: (target: ItemDropTarget) => ReactNode
) {
  let {CollectionNode = DefaultCollectionRenderer.CollectionNode} = useContext(CollectionRendererContext);

  return useCachedChildren({
    items: parent ? collection.getChildren!(parent.key) : collection,
    dependencies: [CollectionNode, parent, renderDropIndicator],
    children(node) {
      let pseudoProps = {};

      if (renderDropIndicator && node.type === 'item') {
        pseudoProps = {
          before: renderDropIndicator({type: 'item', key: node.key, dropPosition: 'before'}),
          after: renderAfterDropIndicators(collection, node, renderDropIndicator)
        };
      }

      return <CollectionNode {...pseudoProps} node={node} parent={parent} collection={collection} key={node.key} />;
    }
  });
}

export function renderAfterDropIndicators(collection: ICollection<Node<unknown>>, node: Node<unknown>, renderDropIndicator: (target: ItemDropTarget) => ReactNode): ReactNode {
  let key = node.key;
  let keyAfter = collection.getKeyAfter(key);
  let nextItemInFlattenedCollection = keyAfter != null ? collection.getItem(keyAfter) : null;
  while (nextItemInFlattenedCollection != null && nextItemInFlattenedCollection.type !== 'item') {
    keyAfter = collection.getKeyAfter(nextItemInFlattenedCollection.key);
    nextItemInFlattenedCollection = keyAfter != null ? collection.getItem(keyAfter) : null;
  }

  let nextItemInSameLevel = node.nextKey != null ? collection.getItem(node.nextKey) : null;
  while (nextItemInSameLevel != null && nextItemInSameLevel.type !== 'item') {
    nextItemInSameLevel = nextItemInSameLevel.nextKey != null ? collection.getItem(nextItemInSameLevel.nextKey) : null;
  }

  // Render one or more "after" drop indicators when the next item in the flattened collection
  // has a smaller level, is not an item, or there are no more items in the collection.
  // Otherwise, the "after" position is equivalent to the next item's "before" position.
  let afterIndicators: ReactNode[] = [];
  if (nextItemInSameLevel == null) {
    let current: Node<unknown> | null = node;
    while (current && (!nextItemInFlattenedCollection || (current.parentKey !== nextItemInFlattenedCollection.parentKey && nextItemInFlattenedCollection.level < current.level))) {
      let indicator = renderDropIndicator({
        type: 'item',
        key: current.key,
        dropPosition: 'after'
      });
      if (isValidElement(indicator)) {
        afterIndicators.push(cloneElement(indicator, {key: `${current.key}-after`}));
      }
      current = current.parentKey != null ? collection.getItem(current.parentKey) : null;
    }
  }

  return afterIndicators;
}

export const CollectionRendererContext = createContext<CollectionRenderer<any>>(DefaultCollectionRenderer);

type PersistedKeysReturnValue = Set<Key> | null;
export function usePersistedKeys(focusedKey: Key | null): PersistedKeysReturnValue {
  return useMemo(() => focusedKey != null ? new Set([focusedKey]) : null, [focusedKey]);
}

export class ScrollTarget {
  /**
   * The type of element represented by this target. Should match the `type` of the corresponding collection node.
   */
  type: string;

  /**
   * A unique key for this target. Should match the `key` of the corresponding collection node.
   */
  key: Key;

  /**
   * The rectangle describing the size and position of this target.
   */
  rect: Rect;

  /** 
   * The alignment within the snapport. 
   */
  alignment: string;

  /**
   * Whether the size is estimated. `false` by default.
   * Targets with estimated sizes will be measured the first time they are added to the DOM.
   * The estimated size & alignment is used to calculate the offset for scroll animations.
   * @default false
   */
  estimatedSize: boolean;

  constructor(type: string, key: Key, rect: Rect) {
    this.key = key;
    this.rect = rect;
    this.type = type;
    this.alignment = 'start';
    this.estimatedSize = false;
  }

  /**
   * Returns a copy of the SnapTarget.
   */
  copy(): ScrollTarget {
    let target = new ScrollTarget(this.type, this.key, this.rect);
    target.alignment = this.alignment;
    target.estimatedSize = this.estimatedSize;
    return target;
  }
}

export interface IScrollDelegate extends KeyboardDelegate {
  /** Whether the scroll container is at the end of the scrollable content. */
  isScrollEnd(): boolean,
  /** Whether the scroll container is at the start of the scrollable content. */
  isScrollStart(): boolean,
  /** Returns the scroll port of the scroll container. */
  getScrollPort(): Rect,
  /** Performs a scroll animation to a given point. */
  scroll(options: ScrollToOptions): void,
  /** Returns the scroll target for a given key. */
  getScrollTarget(key: Key): ScrollTarget | null,
  /** Returns the scroll targets that are currently visible in the scroll container. */
  getVisibleScrollTargets(): ScrollTarget[]
}

export interface ScrollDelegateOptions {
  direction?: Direction,
  layoutDelegate?: LayoutDelegate,
  collection: ICollection<Node<unknown>>,
  orientation?: Orientation | 'both',
  ref: RefObject<HTMLElement | null>
}

export class ScrollDelegate implements IScrollDelegate {
  private orientation: Orientation | 'both';
  
  protected direction: Direction;
  protected layoutDelegate: LayoutDelegate;
  protected ref: RefObject<HTMLElement | null>;
  protected collection: ICollection<Node<unknown>>;
  protected targets: Map<Key, ScrollTarget> = new Map();

  constructor(opts: ScrollDelegateOptions) {
    this.ref = opts.ref;
    this.collection = opts.collection;
    this.direction = opts.direction || 'ltr';
    this.orientation = opts.orientation || 'both';
    this.layoutDelegate = opts.layoutDelegate || new DOMLayoutDelegate(opts.ref);
  }

  private findKey(key: Key | null, next: (key: Key) => Key | null): Key | null {
    if (!key || !this.isValid(key)) {return null;}

    do {
      key = next(key!);
    } while (key !== null && !this.isValid(key));

    return key;
  }

  protected isValid(key: Key): boolean {
    let item = this.collection.getItem(key);
    let rect = this.layoutDelegate.getItemRect(key);

    // TODO: Find a way to skip "utility" items, e.g. loader, separator, etc.
    if (!rect || item?.hasChildNodes) {
      return false;
    }

    switch (this.getOrientation()) {
      case 'both':
        return rect.width > 0 || rect.height > 0;
      case 'horizontal':
        return rect.width > 0;
      case 'vertical':
        return rect.height > 0;
    }
  }

  getScrollPort(): Rect {
    if (!this.ref.current) {
      return this.layoutDelegate.getVisibleRect();
    }

    return getScrollPort(this.ref.current);
  }

  getOrientation(): Orientation | 'both' {
    // TODO: Use layoutDelegate.getOrientation() as fallback once PR #8533 lands?
    return this.orientation;
  }

  getScrollOptions(target: ScrollTarget): ScrollToOptions {
    let [block, inline = block] = target.alignment.split(' ');

    if (this.getOrientation() === 'both') {
      x = target.rect.x + target.rect.width;
      y = target.rect.y + target.rect.height;
    }
    
    if (this.getOrientation() === 'horizontal') {
      x = target.rect.x + target.rect.width / 2;
      y = target.rect.y + target.rect.height / 2;
    }

    x = target.rect.x;
    y = target.rect.y;

    return {left: x, top: y};
  }

  scroll(opts: ScrollToOptions): void {
    this.ref.current?.scroll(opts);
  }

  isScrollEnd(): boolean {
    let rect = this.layoutDelegate.getVisibleRect();
    let size = this.layoutDelegate.getContentSize();

    let isHorizontalEnd = rect.x + rect.width >= size.width;
    let isVerticalEnd = rect.y + rect.height >= size.height;

    switch (this.getOrientation()) {
      case 'both':
        return isHorizontalEnd && isVerticalEnd;
      case 'horizontal':
        return isHorizontalEnd;
      case 'vertical':
        return isVerticalEnd;
    }
  }

  isScrollStart(): boolean {
    let rect = this.layoutDelegate.getVisibleRect();

    let isHorizontalStart = rect.x <= 0;
    let isVerticalStart = rect.y <= 0;

    switch (this.getOrientation()) {
      case 'both':
        return isHorizontalStart && isVerticalStart;
      case 'horizontal':
        return isHorizontalStart;
      case 'vertical':
        return isVerticalStart;
    }
  }

  getScrollTarget(key: Key): ScrollTarget | null {
    let target = this.targets.get(key);

    if (target) {return target;}

    let item = this.collection.getItem(key);
    let rect = this.layoutDelegate.getItemRect(key);

    if (!rect || !item || !this.ref.current) {
      return null;
    }

    let {scrollSnapType} = getComputedStyle(this.ref.current);

    target = new ScrollTarget(item.type, key, rect);
    target.isSnappable = scrollSnapType !== 'none';
    target.
    this.targets.set(key, target);
    return target;
  }

  getVisibleScrollTargets(): Key | null {
    let rect = this.layoutDelegate.getVisibleRect();
    let items = this.layoutDelegate.getVisibleLayoutInfos(rect);
    return items.map(item => item.key);
  }

  getNextKey(key: Key): Key | null {
    let method = this.getOrientation() === 'vertical' || this.direction === 'ltr' ? 'getKeyAfter' : 'getKeyBefore';
    return this.findKey(this.collection[method](key), this.collection[method]);
  }

  getPreviousKey(key: Key): Key | null {
    let method = this.getOrientation() === 'vertical' || this.direction === 'ltr' ? 'getKeyBefore' : 'getKeyAfter';
    return this.findKey(this.collection[method](key), this.collection[method]);
  }

  getFirstKey(): Key | null {
    return this.findKey(this.collection.getFirstKey(), this.getNextKey);
  }

  getLastKey(): Key | null {
    return this.findKey(this.collection.getLastKey(), this.getPreviousKey);
  }

  getKeyAbove?(key: Key): Key | null {
    let next = this.layoutDelegate['getKeyAbove'];

    if (typeof next === 'function') {
      return this.findKey(next(key), next);
    }

    return this.getPreviousKey(key);
  }

  getKeyBelow?(key: Key): Key | null {
    let next = this.layoutDelegate['getKeyBelow'];

    if (typeof next === 'function') {
      return this.findKey(next(key), next);
    }

    return this.getNextKey(key);
  }

  getKeyRightOf?(key: Key): Key | null {
    let next = this.direction === 'ltr' ? this.layoutDelegate['getKeyRightOf'] : this.layoutDelegate['getKeyLeftOf'];

    if (typeof next === 'function') {
      return this.findKey(next(key), next);
    }

    return this.getNextKey(key);
  }

  getKeyLeftOf?(key: Key): Key | null {
    let next = this.direction === 'ltr' ? this.layoutDelegate['getKeyLeftOf'] : this.layoutDelegate['getKeyRightOf'];

    if (typeof next === 'function') {
      return this.findKey(next(key), next);
    }

    return this.getPreviousKey(key);
  }

  updateItemSize(key: Key, rect: Rect, alignment?: string): boolean {
    let target = this.targets.get(key);

    if (!target) {
      let item = this.collection.getItem(key);
      if (item) {
        this.targets.set(key, new ScrollTarget(item.type, key, rect));
      }
      return false;
    }

    target.rect = rect;
    target.estimatedSize = false;

    if (typeof alignment !== 'undefined' && target.alignment !== alignment) {
      target.alignment = alignment;
    }

    return true;
  }
}

export interface RotatorDelegateItemProps {
  scrollTarget: ScrollTarget | null,
  scrollDelegate: ScrollDelegate,
  ref: RefObject<HTMLElement | null>
}

export function useScrollDelegate(props: ScrollDelegateOptions): void {
  let {ref, collection, orientation, direction, layoutDelegate} = props;

  let [layout] = useState(() => layoutDelegate || new DOMLayoutDelegate(ref));

  let [delegate] = useState(() => new ScrollDelegate({
    ref, 
    collection,
    orientation, 
    direction, 
    layoutDelegate: layout
  }));
  
  useEffect(() => {
    for (let key of collection.getKeys()) {
      let rect = layout.getItemRect(key);
      console.log(key, rect);
      if (rect) {delegate.updateItemSize(key, rect);}
    }

    console.log(collection.getKeys(), delegate);
  }, [collection]);

  return;
}

export function useScrollTarget(props: RotatorDelegateItemProps, ref: RefObject<HTMLElement | null>): {updateItemSize: () => void} {
  let {scrollTarget, scrollDelegate} = props;
  let key = scrollTarget?.key;

  let updateItemSize = useCallback(() => {
    if (key != null && ref.current) {
      let rect = getSnapArea(ref.current);
      let {scrollSnapAlign} = getComputedStyle(ref.current);
      scrollDelegate.updateItemSize(key, rect, scrollSnapAlign);
    }
  }, [scrollDelegate, key, ref]);

  // Update in the next frame to wait for layout size changes.
  useEffect(() => void requestAnimationFrame(() => {
    if (scrollTarget?.estimatedSize) {
      updateItemSize();
    }
  }));

  return {updateItemSize};
}
