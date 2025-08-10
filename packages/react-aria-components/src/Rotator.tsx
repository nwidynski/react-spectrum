 
 
import {AriaButtonOptions} from '@react-aria/button';
import {AriaTabListProps, useTab, useTabList} from '@react-aria/tabs';
import {ButtonContext} from './Button';
import {Collection, CollectionBuilder, createLeafComponent} from '@react-aria/collections';
import {CollectionNodeProps, CollectionProps, CollectionRendererContext, CollectionRootProps, DefaultCollectionRenderer, IScrollDelegate, ScrollDelegate, ScrollDelegateOptions} from './Collection';
import {ContextValue, DEFAULT_SLOT, Provider, RenderProps, StyleRenderProps, useContextProps, useRenderProps} from './utils';
import {Direction, forwardRefType, Collection as ICollection, Key, KeyboardDelegate, LayoutDelegate, Node, Orientation, Rect, RefObject, Size} from '@react-types/shared';
import {DOMLayoutDelegate} from '@react-aria/selection';
import {filterDOMProps, getScrollPort, mergeProps, useEffectEvent, useLayoutEffect, useObjectRef, useScrollView} from '@react-aria/utils';
import React, {createContext, ElementType, ForwardedRef, forwardRef, JSX, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {TabListState, useTabListState} from '@react-stately/tabs';
import {useFocusRing} from '@react-aria/focus';
import {useHover} from '@react-aria/interactions';
import {useLocale} from '@react-aria/i18n';
import {useSyncExternalStore} from 'use-sync-external-store/shim';

export interface IScrollManager {
  /** Whether the scroll container is at the end of the collection. */
  isScrollEnd(): boolean,
  /** Whether the scroll container is at the start of the collection. */
  isScrollStart(): boolean,
  /** Scrolls to the given key. */
  scrollTo(key: Key, behavior?: ScrollBehavior): void,
  /** Scrolls to the next item. */
  scrollNext(behavior?: ScrollBehavior): void,
  /** Scrolls to the previous item. */
  scrollPrevious(behavior?: ScrollBehavior): void,
  /** Scrolls to the start of the collection. */
  scrollStart(behavior?: ScrollBehavior): void,
  /** Scrolls to the end of the collection. */
  scrollEnd(behavior?: ScrollBehavior): void
}

interface ScrollManagerClass {
  new(): ScrollManager
}

type ScrollDelegateRegistry = Map<RefObject<HTMLElement | null>, IScrollDelegate>;

export abstract class CRotationManager implements IScrollManager {
  /** The registry the scroll manager is currently managing. */
  delegates: ScrollDelegateRegistry | null = null;

  abstract isScrollEnd(): boolean;
  abstract isScrollStart(): boolean;
  abstract scrollTo(key: Key, behavior?: ScrollBehavior): void;
  abstract scrollNext(behavior?: ScrollBehavior): void;
  abstract scrollPrevious(behavior?: ScrollBehavior): void;
  abstract scrollStart(behavior?: ScrollBehavior): void;
  abstract scrollEnd(behavior?: ScrollBehavior): void;

  clone?(): CRotationManager;
}

export interface LayoutScrollDelegateProps {
  ref: RefObject<HTMLElement | null>,
  layoutDelegate: LayoutDelegate,
  collection: ICollection<any>,
  direction?: Direction,
  orientation?: Orientation
}

export interface RotatorDelegateProps {
  rotationManager: RotationManager,
  scrollDelegate?: IScrollDelegate,
  layoutDelegate?: LayoutDelegate,
  collection: ICollection<any>,
  orientation?: Orientation
}

export interface RotatorStateOptions {
  isDisabled?: boolean,
  defaultPlaying?: boolean,
  rotationBehavior?: ScrollBehavior,
  allowScroll?: boolean,
  shouldWrap?: boolean,
  rotationManager?: RotationManager
}

export interface RotatorState {
  isDisabled: boolean,
  isPlaying: boolean,
  isScrollEnd: boolean,
  isScrollStart: boolean,
  rotationManager: RotationManager,
  setIsPlaying(value: boolean): void
}

export interface RotatorRenderProps extends RotatorState {
}

export interface RotatorProps extends Pick<RenderProps<RotatorRenderProps>, 'children'>, RotatorStateOptions {
  /**
   * The scroll delegate to use for the rotator.
   */
  manager?: ScrollManagerClass | ScrollManager
}

export interface RotatorAria {
  playButtonProps: AriaButtonOptions<ElementType>,
  topButtonProps: AriaButtonOptions<ElementType>,
  bottomButtonProps: AriaButtonOptions<ElementType>,
  nextButtonProps: AriaButtonOptions<ElementType>,
  previousButtonProps: AriaButtonOptions<ElementType>
}

export interface RotatorTabListRenderProps {
  /**
   * The orientation of the tab list.
   * @selector [data-orientation="horizontal | vertical"]
   */
  orientation: Orientation,
  /**
   * State of the tab list.
   */
  state: TabListState<unknown>
}

export interface RotatorTabListProps<T extends object> extends StyleRenderProps<RotatorTabListRenderProps>, CollectionProps<T>, Omit<AriaTabListProps<T>, 'children'> {
}

export interface RotatorTabListInnerProps<T extends object> {
  props: RotatorTabListProps<T>,
  collection: ICollection<Node<T>>,
  tabListRef: ForwardedRef<HTMLDivElement | null>
}

export interface RotatorTabRenderProps {
  /**
   * Whether the tab is currently hovered with a mouse.
   * @selector [data-hovered]
   */
  isHovered: boolean,
  /**
   * Whether the tab is currently in a pressed state.
   * @selector [data-pressed]
   */
  isPressed: boolean,
  /**
   * Whether the tab is currently selected.
   * @selector [data-selected]
   */
  isSelected: boolean,
  /**
   * Whether the tab is currently focused.
   * @selector [data-focused]
   */
  isFocused: boolean,
  /**
   * Whether the tab is currently keyboard focused.
   * @selector [data-focus-visible]
   */
  isFocusVisible: boolean,
  /**
   * Whether the tab is disabled.
   * @selector [data-disabled]
   */
  isDisabled: boolean
}

export interface RotatorTabProps extends RenderProps<RotatorTabRenderProps> {

}

export type Alignment = 'start' | 'center' | 'end';

export interface SnapTargetOptions {
  isSelected?: boolean,
  alignment?: Alignment | 'none'
}

class SnapTarget {
  /** The key of the snap target. */
  key: Key;

  /** The rect of the snap target. */
  rect: Rect;

  /** The type of the snap target. */
  type: string;

  /** The alignment of the snap target. */
  alignment: Alignment | 'none';

  constructor(type: string, key: Key, rect: Rect, options: SnapTargetOptions = {}) {
    this.key = key;
    this.rect = rect;
    this.type = type;
    this.alignment = options.alignment || 'none';
  }

  /**
   * Returns a copy of the SnapTarget.
   */
  copy(): SnapTarget {
    return new SnapTarget(this.type, this.key, this.rect, {
      alignment: this.alignment
    });
  }
}

interface ISnapDelegate {
  getSnapPort(): Rect
}

class SnapDelegate extends ScrollDelegate implements ISnapDelegate {
  private snapTargets: Map<Key, SnapTarget> = new Map();

  constructor(opts: ScrollDelegateOptions) {
    super(opts);
  }

  getItemSnapTarget(key: Key): boolean {
    let item = this.collection.getItem(key);
    let children = this.collection.getChildren?.(key) || [];
    return item?.type !== 'loader' && Array.from(children).length > 0;
  }

  updateItemSnapTarget(key: Key, rect: Rect) {
    let target = this.targets.get(key);
    if (target) {
      target.rect = rect;
    }
  }

  override isValid(key: Key): boolean {
    let targets = this.snapTargets.size > 0;

    let rect = this.layout.getItemRect(key);
    if (!rect) {return false;}

    return rect.width > 0 || rect.height > 0;
  }

  private findKey(key: Key, nextKey: (key: Key) => Key | null, shouldSkip: (key: Key) => boolean): Key | null {
    let next: Key | null = key;

    do {
      next = nextKey(next);
    } while (next !== null && shouldSkip(next));

    return next;
  }
}

interface ScrollManagerOptions {
  layout: LayoutDelegate,
  delegate: IScrollDelegate,
  collection: ICollection<any>
}

class ScrollManager {
  readonly layout: LayoutDelegate;
  readonly delegate: IScrollDelegate;
  readonly collection: ICollection<any>;

  constructor(options: ScrollManagerOptions) {
    this.delegate = options.delegate;
    this.layout = options.layout;
    this.collection = options.collection;
  }

  getSnapKey(): Key | null {
    if (!this.ref.current) {return null;}

    let selector = '[data-key]';
    let collection = this.ref.current.dataset.collection;
    if (collection) {
      selector = `[data-collection="${CSS.escape(collection)}"]${selector}`;
    }

    let snapport = this.getSnapPort();

    for (let el of this.ref.current.querySelectorAll<HTMLElement>(selector)) {
      let item = this.manager!.collection.getItem(el.dataset.key!);
      let rect = this.manager!.layout.getItemRect(item.key);

      // TODO: Mutate the rect to account for scroll margin?
      // TODO: Reuse Rect and Size classes?

      if (
        rect &&
        rect.x >= snapport.x &&
        rect.x + rect.width <= snapport.x + snapport.width &&
        rect.y >= snapport.y &&
        rect.y + rect.height <= snapport.y + snapport.height
      ) {
        return item.key;
      }
    }

    return null;
  }

  getItemSnapTarget(key: Key): SnapTarget | null {
    let target = this.snapTargets.get(key);

    if (!target) {
      let item = this.collection.getItem(key);
      let rect = this.layout.getItemRect(key);

      // TODO: Mutate the rect to account for scroll margin?
      target = new SnapTarget(item.type, key, rect);
    }

    return target;
  }

  /**
   * Returns whether the snap target should invalidate in response to
   * item rectangle changes.
   */
  shouldInvalidateSnapTarget(key: Key) {
    let target = this.snapTargets.get(key);
    let rect = this.layout.getItemRect(key);

    return !target || !rect || (
      target.rect.x !== rect.x && 
      target.rect.y !== rect.y && 
      target.rect.width !== rect.width && 
      target.rect.height !== rect.height
    );
  }

  updateSnapTarget(key: Key, rect: Rect, options: SnapTargetOptions) {
    let target = this.snapTargets.get(key);

    if (target) {
      target.rect = rect;
      Object.assign(target, options);
    }
  }
}

class RotatorStore {
  private subscriptions = new Set<() => void>();
  private registry: ScrollDelegateRegistry = new Map();

  constructor(manager: RotationManager) {
    manager.delegates = this.registry;
  }

  queueUpdate() {
    for (let notification of this.subscriptions) {
      notification();
    }
  }

  subscribe(fn: () => void) {
    this.subscriptions.add(fn);
    return () => void this.subscriptions.delete(fn);
  }

  register(ref: RefObject<HTMLElement | null>, delegate: IScrollDelegate) {
    this.registry.set(ref, delegate);
    this.queueUpdate();

    return () => {
      this.registry.delete(ref);
      this.queueUpdate();
    };
  }
}

interface RotationManagerOptions {
  rotationBehavior: ScrollBehavior
}

class RotationManager extends CRotationManager {
  private rotationBehavior: ScrollBehavior;

  constructor(opts: RotationManagerOptions) {
    super();
    this.rotationBehavior = opts.rotationBehavior ?? 'auto';
  }

  get size() {
    return this.delegates!.size;
  }

  get snapTargets() {
    if (this.size === 0) {
      return [];
    }

    return this.collections.values().flatMap(collection => {
      return Array.from(collection.getKeys());
    });
  }

  isScrollEnd(ref?: RefObject<HTMLElement | null>) {
    return this.delegates!.entries().every(([ref, delegate]) => {
      return ref.current?.scrollHeight === ref.current?.scrollTop + ref.current?.clientHeight;
    });
  }

  isScrollStart(ref?: RefObject<HTMLElement | null>) {
    return this.delegates!.entries().every(([ref, delegate]) => {
      return ref.current?.scrollTop === 0;
    });
  }

  scrollTo(key: Key, behavior = this.rotationBehavior) {
    for (let [ref, delegate] of this.delegates!.entries()) {
      let snapport = delegate.getSnapPort();
      let target = delegate.getItemSnapTarget(key);

      if (target) {
        ref.current?.scrollBy({
          left: target.rect.x - snapport.x,
          top: target.rect.y - snapport.y,
          behavior
        });
      }
    }
  }

  scrollStart(behavior: ScrollBehavior = this.rotationBehavior) {
    for (let [ref, delegate] of this.delegates!.entries()) {
      let target = delegate.getSnapTarget();
        
    }
  }

  scrollEnd(behavior: ScrollBehavior = this.rotationBehavior) {
    for (let [ref, delegate] of this.delegates!.entries()) {
      let target = delegate.getSnapTarget();
        
    }
  }

  scrollPrevious(behavior = this.rotationBehavior) {
    for (let [ref, delegate] of this.delegates!.entries()) {
      let current = delegate.getSnapTarget();
      let previous = current ? delegate.getPreviousSnapTarget(current.key) : null;

      if (current && previous) {
        ref.current?.scrollBy({
          left: -previous.rect.width,
          top: -previous.rect.height,
          behavior
        });
      }
    }

  }
  
  scrollNext(behavior = this.rotationBehavior) {
    for (let [ref, delegate] of this.delegates!.entries()) {
      let current = delegate.getSnapTarget();
      let next = current ? delegate.getNextSnapTarget(current.key) : null;

      if (current && next) {
        ref.current?.scrollBy({
          left: current.rect.width,
          top: current.rect.height,
          behavior
        });
      }
    }
  }

  clone(): RotationManager {
    let manager = new RotationManager({rotationBehavior: this.rotationBehavior});
    manager.delegates = new Map(this.delegates);
    return manager;
  }
}

let storeMap = new Map<RotationManager, RotatorStore>();

export function useRotatorState(props: RotatorStateOptions): RotatorState {
  let {rotationManager, rotationBehavior = 'auto', defaultPlaying = false, isDisabled = false} = props;

  let manager = useMemo(() => rotationManager || new RotationManager({
    rotationBehavior
  }), [rotationManager, rotationBehavior]);

  let store = useMemo(() => new RotatorStore(manager), [manager]);
  storeMap.set(manager, store);

  let [isPlaying, setIsPlaying] = useState(() => {
    if (typeof window === 'undefined') {return false;}

    let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    return defaultPlaying && !reducedMotion.matches;
  });

  let getServerScrollEnd = useCallback(() => false, []);
  let getServerScrollStart = useCallback(() => true, []);
  let getScrollEnd = useCallback(() => manager.isScrollEnd(), [manager]);
  let getScrollStart = useCallback(() => manager.isScrollStart(), [manager]);
  let subscribe = useCallback((fn: () => void) => store.subscribe(fn), [store]);

  let isScrollEnd = useSyncExternalStore(subscribe, getScrollEnd, getServerScrollEnd);
  let isScrollStart = useSyncExternalStore(subscribe, getScrollStart, getServerScrollStart);

  let state = useMemo(() => ({
    isPlaying, 
    isDisabled,
    isScrollEnd,
    isScrollStart,
    setIsPlaying,
    rotationManager: manager
  }), [manager, isPlaying, isDisabled, isScrollEnd, isScrollStart]);

  return state;
}

export function useRotator(props: RotatorProps, state: RotatorState): RotatorAria {

  let togglePlay = useEffectEvent(() => {
    state.setIsPlaying(!state.isPlaying);
  });

  let onScrollNext = useEffectEvent(() => {
    state.rotationManager.scrollNext();
  });

  let onScrollPrevious = useEffectEvent(() => {
    state.rotationManager.scrollPrevious();
  });

  let onScrollStart = useEffectEvent(() => {
    state.rotationManager.scrollStart();
  });

  let onScrollEnd = useEffectEvent(() => {
    state.rotationManager.scrollEnd();
  });

  return {
    playButtonProps: {
      'aria-label': 'Stop rotation',
      onPress: togglePlay,
      isDisabled: state.isDisabled
    }, 
    nextButtonProps: {
      'aria-label': 'Scroll to next',
      excludeFromTabOrder: true,
      onPress: onScrollNext,
      isDisabled: state.isDisabled || state.isScrollEnd
    }, 
    previousButtonProps: {
      'aria-label': 'Scroll to previous',
      excludeFromTabOrder: true,
      onPress: onScrollPrevious,
      isDisabled: state.isDisabled || state.isScrollStart
    },
    topButtonProps: {
      'aria-label': 'Scroll to top',
      excludeFromTabOrder: true,
      onPress: onScrollStart,
      isDisabled: state.isDisabled || state.isScrollStart
    },
    bottomButtonProps: {
      'aria-label': 'Scroll to bottom',
      excludeFromTabOrder: true,
      onPress: onScrollEnd,
      isDisabled: state.isDisabled || state.isScrollEnd
    }
  };
}

interface RotatorDelegateState {
  contentSize: Size,
  isScrollable: boolean,
  rotationManager: RotationManager,
  snapTarget: SnapTarget | null,
  setVisibleRect(rect: Rect): void,
  startScrolling(): void,
  endScrolling(): void
}

export function useRotatorDelegateState(props: RotatorDelegateProps): RotatorDelegateState {
  let {collection, layoutDelegate, rotationManager, scrollDelegate} = props;

  let store = storeMap.get(rotationManager)!;
  let manager = useMemo(() => new ScrollManager({
    ref,
    collection,
    layout: layoutDelegate,
    delegate
  }), [collection, layoutDelegate, delegate]);

  let state = useRef({
    shouldWait: false
  });

  let setVisibleRect = useEffectEvent(() => {
    if (state.current.shouldWait) {return;} 

    store.queueUpdate();
    state.current.shouldWait = true;
    setTimeout(() => {
      state.current.shouldWait = false;
    }, 50);
  });

  let startScrolling = useEffectEvent(() => {

  });

  let endScrolling = useEffectEvent(() => {

  });
  

  return {
    scrollManager,
    setVisibleRect,
    startScrolling,
    endScrolling,
    snapTarget
  };
}

// Use the earliest effect type possible. useInsertionEffect runs during the mutation phase,
// before all layout effects, but is available only in React 18 and later.
const useEarlyEffect = React['useInsertionEffect'] ?? useLayoutEffect;

export function useRotatorDelegate(props: RotatorDelegateProps, state: RotatorDelegateState, ref: RefObject<HTMLElement | null>): void {
  let {collection, layoutDelegate, scrollDelegate, orientation = 'vertical'} = props;
  let {isScrollable, rotationManager} = state;

  let {direction} = useLocale();

  let store = storeMap.get(scrollManager)!;

  let layout = useMemo(() => layoutDelegate || new DOMLayoutDelegate(ref!), [layoutDelegate, ref]);
  let delegate = useMemo(() => scrollDelegate || new LayoutScrollDelegate({
    ref,
    direction,
    collection,
    orientation,
    layoutDelegate: layout
  }), [collection, layout, scrollDelegate, ref, orientation, direction]);

  useEarlyEffect(() => {
    store.register(ref, delegate);
  }, [ref, delegate, store]);
}

export interface RotatorDelegateItemProps {
  key: Key,
  manager: ScrollManager
}

export function useRotatorDelegateItem(props: RotatorDelegateItemProps, ref: RefObject<HTMLElement | null>): {updateSnapArea: () => void} {
  let {key, manager} = props;

  let updateSnapArea = useCallback(() => {
    if (key != null && ref.current) {
      let rect = getSnapArea(ref.current);
      manager.updateSnapTargetArea(key, rect);
    }
  }, [manager, key, ref]);

  // Update in the next frame to wait for layout size changes.
  useEffect(() => void requestAnimationFrame(() => {
    if (manager.shouldInvalidateSnapTarget(key)) {
      updateSnapArea();
    }
  }));

  return {updateSnapArea};
}

function getSnapArea(el: HTMLElement): Rect {
  let {x, y, width, height} = el.getBoundingClientRect();
  let style = getComputedStyle(el);

  let scrollMarginTop = parseFloat(style.scrollMarginTop) || 0;
  let scrollMarginBottom = parseFloat(style.scrollMarginBottom) || 0;
  let scrollMarginLeft = parseFloat(style.scrollMarginLeft) || 0;
  let scrollMarginRight = parseFloat(style.scrollMarginRight) || 0;

  x -= scrollMarginLeft;
  y -= scrollMarginTop;
  width += scrollMarginLeft + scrollMarginRight;
  height += scrollMarginTop + scrollMarginBottom;

  return {x, y, width, height};
}

export function useRotatorTabListState() {
  return;
}

export function useRotatorTabList(props: RotatorTabListProps<any>, state: RotatorState, ref?: RefObject<HTMLElement | null>): void {
  let store = storeMap.get(state)!;
}


export const RotatorContext = createContext<RotatorState | null>(null);
const RotatorRendererContext = createContext(DefaultCollectionRenderer);

function CollectionRoot({collection, scrollRef, ...props}: CollectionRootProps): JSX.Element {
  let {rotationManager} = useContext(RotatorContext)!;
  let {CollectionRoot} = useContext(RotatorRendererContext);

  let {direction} = useLocale();

  let ref = useObjectRef(scrollRef);
  let state = useRotatorDelegateState({collection, rotationManager});
  useRotatorDelegate({collection, rotationManager}, state, ref);

  useScrollView({
    onVisibleRectChange: state.setVisibleRect,
    contentSize: state.contentSize,
    onScrollStart: state.startScrolling,
    onScrollEnd: state.endScrolling,
    direction
  }, ref);

  return <CollectionRoot collection={collection} scrollRef={scrollRef} {...props} />;
}

function CollectionNode({node, itemRef, ...props}: CollectionNodeProps): JSX.Element {
  let {CollectionNode} = useContext(RotatorRendererContext);

  let ref = useObjectRef(itemRef);

  useRotatorDelegateItem({key: node.key}, ref);

  return <CollectionNode node={node} {...props} itemRef={ref}  />;
}

export function Rotator(props: RotatorProps): JSX.Element {
  let {manager} = props;

  let rotationManager = useMemo(() => typeof manager === 'function' ? new manager() : manager, [manager]);
  let state = useRotatorState({...props, rotationManager});

  let {
    playButtonProps, 
    topButtonProps, 
    bottomButtonProps, 
    nextButtonProps, 
    previousButtonProps
  } = useRotator(props, state);

  let {children} = useRenderProps({...props, values: state});

  let context = useContext(CollectionRendererContext);
  let renderer = useMemo(() => ({...context, CollectionRoot, CollectionNode}), [context]);

  return (
    <Provider
      children={children}
      values={[
        [CollectionRendererContext, renderer],
        [RotatorRendererContext, context],
        [RotatorContext, state],
        [ButtonContext, {
          slots: {
            [DEFAULT_SLOT]: {},
            play: playButtonProps,
            top: topButtonProps,
            bottom: bottomButtonProps,
            next: nextButtonProps, 
            previous: previousButtonProps
          }
        }]
      ]} />
  );
}

export const RotatorTabListContext = createContext<ContextValue<RotatorTabListProps<any>, HTMLDivElement>>(null);
export const RotatorTabListStateContext = createContext<TabListState<any> | null>(null);

export const RotatorTabList = /*#__PURE__*/ (forwardRef as forwardRefType)(function RotatorTabList<T extends object>(props: RotatorTabListProps<T>, ref: ForwardedRef<HTMLDivElement>): JSX.Element {
  [props, ref] = useContextProps(props, ref, RotatorTabListContext);

  return (
    <CollectionBuilder content={<Collection {...props} />}>
      {/* @ts-expect-error */}
      {(collection) => <RotatorTabListSynchronizer<T> props={props} collection={collection} tabListRef={ref} />}
    </CollectionBuilder>
  );
});

function RotatorTabListSynchronizer<T extends object>({props, collection, tabListRef}: RotatorTabListInnerProps<T>): JSX.Element {
  let {isDisabled, rotationManager} = useContext(RotatorContext)!;

  let snapTargets = useMemo(() => {
    return Array.from(rotationManager.snapTargets);
  }, [rotationManager]);

  let synchronized = useMemo(() => {
    // TODO: Filter based on node key when PR #8641 lands.
    return collection;
  }, [collection]);

  return (
    <RotatorContext.Provider value={null}>
      <RotatorTabListInner<T> props={{...props, isDisabled}} collection={synchronized} tabListRef={tabListRef} />
    </RotatorContext.Provider>
  );
}

function RotatorTabListInner<T extends object>({props, collection, tabListRef}: RotatorTabListInnerProps<T>): JSX.Element {
  let {CollectionRoot} = useContext(CollectionRendererContext);
  let {orientation = 'horizontal', keyboardActivation = 'automatic'} = props;

  let state = useTabListState<T>({   
    ...props,
    collection,
    children: undefined
  });

  let ref = useObjectRef(tabListRef);

  let {tabListProps} = useTabList({
    ...props,
    orientation,
    keyboardActivation
  }, state, ref);

  let renderProps = useRenderProps({
    ...props,
    children: null,
    defaultClassName: 'react-aria-RotatorTabList',
    values: {
      orientation,
      state
    }
  });

  return (
    <div {...mergeProps(renderProps, tabListProps)} role="radiogroup" ref={ref}>
      <RotatorTabListStateContext.Provider value={state}>
        <CollectionRoot collection={collection} scrollRef={ref} />
      </RotatorTabListStateContext.Provider>
    </div>
  );
}

export const RotatorTab = createLeafComponent('item', function RotatorTab<T extends object>(props: RotatorTabProps, forwardedRef: ForwardedRef<HTMLDivElement>, item: Node<T>): JSX.Element {
  let state = useContext(RotatorTabListStateContext)!;
  let ref = useObjectRef<any>(forwardedRef);
  let {isSelected, isDisabled, isPressed, tabProps} = useTab({key: item.key}, state, ref);
  let {focusProps, isFocused, isFocusVisible} = useFocusRing();
  let {hoverProps, isHovered} = useHover({
    isDisabled
  });

  let renderProps = useRenderProps({
    ...props,
    id: undefined,
    children: item.rendered,
    defaultClassName: 'react-aria-RotatorTab',
    values: {
      isSelected,
      isDisabled,
      isFocused,
      isFocusVisible,
      isPressed,
      isHovered
    }
  });

  let DOMProps = filterDOMProps(props as any, {global: true});
  delete DOMProps.id;
  delete DOMProps.onClick;

  return (
    <div 
      ref={ref}  
      {...mergeProps(DOMProps, renderProps, tabProps, focusProps, hoverProps)}
      role="radio"
      aria-selected={undefined}
      aria-checked={isSelected}
      data-selected={isSelected || undefined}
      data-disabled={isDisabled || undefined}
      data-focused={isFocused || undefined}
      data-focus-visible={isFocusVisible || undefined}
      data-pressed={isPressed || undefined}
      data-hovered={isHovered || undefined}>
      {renderProps.children}
    </div>
  );
});

