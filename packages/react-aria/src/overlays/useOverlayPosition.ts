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

import {addEvent} from '../utils/domHelpers';
import {DefaultOverlayPositioner} from './DefaultOverlayPositioner';
import {DOMAttributes, RefObject} from '@react-types/shared';
import {getPropagationTargets} from '../utils/shadowdom/DOMFunctions';
import {getRect, PositionOpts, PositionResult} from './calculatePosition';
import {useCallback, useEffect, useRef, useState} from 'react';
import {useCloseOnScroll} from './useCloseOnScroll';
import {useLayoutEffect} from '../utils/useLayoutEffect';
import {useLocale} from '../i18n/I18nProvider';

export type Placement =
  | 'bottom'
  | 'bottom left'
  | 'bottom right'
  | 'bottom start'
  | 'bottom end'
  | 'top'
  | 'top left'
  | 'top right'
  | 'top start'
  | 'top end'
  | 'left'
  | 'left top'
  | 'left bottom'
  | 'start'
  | 'start top'
  | 'start bottom'
  | 'right'
  | 'right top'
  | 'right bottom'
  | 'end'
  | 'end top'
  | 'end bottom';

export type Axis = 'top' | 'bottom' | 'left' | 'right';
export type SizeAxis = 'width' | 'height';
export type PlacementAxis = Axis | 'center';

export interface PositionProps {
  /**
   * The placement of the element with respect to its anchor element.
   *
   * @default 'bottom'
   */
  placement?: Placement;
  /**
   * The placement padding that should be applied between the element and its
   * surrounding container.
   *
   * @default 12
   */
  containerPadding?: number;
  /**
   * The additional offset applied along the main axis between the element and its
   * anchor element.
   *
   * @default 0
   */
  offset?: number;
  /**
   * The additional offset applied along the cross axis between the element and its
   * anchor element.
   *
   * @default 0
   */
  crossOffset?: number;
  /**
   * Whether the element should flip its orientation (e.g. top to bottom or left to right) when
   * there is insufficient room for it to render completely.
   *
   * @default true
   */
  shouldFlip?: boolean;
  // /**
  //  * The element that should be used as the bounding container when calculating container offset
  //  * or whether it should flip.
  //  */
  // boundaryElement?: Element,
  /** Whether the element is rendered. */
  isOpen?: boolean;
}

export interface AriaPositionProps extends PositionProps {
  /**
   * Cross size of the overlay arrow in pixels.
   *
   * @default 0
   */
  arrowSize?: number;
  /**
   * Element that that serves as the positioning boundary.
   *
   * @default document.body
   */
  boundaryElement?: Element;
  /**
   * The ref for the element which the overlay positions itself with respect to.
   */
  targetRef: RefObject<Element | null>;
  /**
   * The ref for the overlay element.
   */
  overlayRef: RefObject<Element | null>;
  /**
   * The ref for the arrow element.
   */
  arrowRef?: RefObject<Element | null>;
  /**
   * A ref for the scrollable region within the overlay.
   *
   * @default overlayRef
   */
  scrollRef?: RefObject<Element | null>;
  /**
   * Whether the overlay should update its position automatically.
   *
   * @default true
   */
  shouldUpdatePosition?: boolean;
  /** Handler that is called when the overlay should close. */
  onClose?: (() => void) | null;
  /**
   * The maxHeight specified for the overlay element.
   * By default, it will take all space up to the current viewport height.
   */
  maxHeight?: number;
  /**
   * The minimum distance the arrow's edge should be from the edge of the overlay element.
   *
   * @default 0
   */
  arrowBoundaryOffset?: number;
  /**
   * Overrides the target element's bounding rectangle. Useful for positioning relative to
   * a specific point such as the mouse cursor (e.g. context menus) or text selection.
   *
   * @default target.getBoundingClientRect()
   * @param target - The target element.
   */
  getTargetRect?: (target: Element) => DOMRect | null | undefined;
  /**
   * Places the overlay and decides when to update its position.
   *
   * @default DefaultOverlayPositioner
   */
  positioner?: OverlayPositioner;
}

export interface PositionAria {
  /** Props for the overlay container element. */
  overlayProps: DOMAttributes;
  /** Props for the overlay tip arrow if any. */
  arrowProps: DOMAttributes;
  /** Placement of the overlay with respect to the overlay trigger. */
  placement: PlacementAxis | null;
  /** The origin of the target in the overlay's coordinate system. Useful for animations. */
  triggerAnchorPoint: {x: number; y: number} | null;
  /** Updates the position of the overlay. */
  updatePosition(): void;
}

let visualViewport = typeof document !== 'undefined' ? window.visualViewport : null;

export interface SubscribeOpts {
  targetNode: Element;
  overlayNode: Element;
  scrollNode: Element;
  boundaryElement: Element;
}

/**
 * Places an overlay relative to its target and tells `useOverlayPosition` when to update it.
 */
export interface OverlayPositioner {
  /** The CSS position the overlay is rendered with once placed. */
  readonly position: 'absolute' | 'fixed';
  /** Observes layout changes that require an update. Returns a function that stops observing. */
  subscribe(opts: SubscribeOpts, updatePosition: () => void): () => void;
  /** Places the overlay. Returns `null` if it cannot place the overlay. */
  update(opts: PositionOpts): PositionResult | null;
}

const DEFAULT_POSITIONER = new DefaultOverlayPositioner();

/**
 * Handles positioning overlays like popovers and menus relative to a trigger
 * element, and updating the position when the window resizes.
 */
export function useOverlayPosition(props: AriaPositionProps): PositionAria {
  let {direction} = useLocale();
  let {
    arrowSize,
    targetRef,
    overlayRef,
    arrowRef,
    scrollRef = overlayRef,
    placement = 'bottom' as Placement,
    containerPadding = 12,
    shouldFlip = true,
    boundaryElement = typeof document !== 'undefined' ? document.body : null,
    offset = 0,
    crossOffset = 0,
    shouldUpdatePosition = true,
    isOpen = true,
    onClose,
    maxHeight,
    arrowBoundaryOffset = 0,
    getTargetRect,
    positioner = DEFAULT_POSITIONER
  } = props;
  let [position, setPosition] = useState<PositionResult | null>(null);

  let deps = [
    shouldUpdatePosition,
    placement,
    // oxlint-disable-next-line react/react-compiler
    overlayRef.current,
    // oxlint-disable-next-line react/react-compiler
    targetRef.current,
    // oxlint-disable-next-line react/react-compiler
    arrowRef?.current,
    // oxlint-disable-next-line react/react-compiler
    scrollRef.current,
    containerPadding,
    shouldFlip,
    boundaryElement,
    offset,
    crossOffset,
    isOpen,
    direction,
    maxHeight,
    arrowBoundaryOffset,
    arrowSize,
    positioner
  ];

  // Note, the position freezing breaks if body sizes itself dynamicly with the visual viewport but that might
  // just be a non-realistic use case
  // Upon opening a overlay, record the current visual viewport scale so we can freeze the overlay styles
  let lastScale = useRef(visualViewport?.scale);
  useEffect(() => {
    if (isOpen) {
      lastScale.current = visualViewport?.scale;
    }
  }, [isOpen]);

  let updatePosition = useCallback(() => {
    if (
      shouldUpdatePosition === false ||
      !isOpen ||
      !overlayRef.current ||
      !targetRef.current ||
      !boundaryElement
    ) {
      return;
    }

    if (visualViewport?.scale !== lastScale.current) {
      return;
    }

    let position = positioner.update({
      placement: translateRTL(placement, direction),
      overlayNode: overlayRef.current,
      targetNode: targetRef.current,
      scrollNode: scrollRef.current || overlayRef.current,
      padding: containerPadding,
      shouldFlip,
      boundaryElement,
      offset,
      crossOffset,
      maxHeight,
      arrowSize: arrowSize ?? (arrowRef?.current ? getRect(arrowRef.current, true).width : 0),
      arrowBoundaryOffset,
      targetRect: getTargetRect?.(targetRef.current)
    });

    if (!position) {
      return;
    }

    // Trigger a set state for a second render anyway for arrow positioning
    setPosition(position);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // oxlint-disable-next-line react/react-compiler, react-hooks/exhaustive-deps
  }, deps);

  // Update position when anything changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // oxlint-disable-next-line react/react-compiler, react-hooks/exhaustive-deps
  useLayoutEffect(updatePosition, deps);

  // Update position when the positioner observes a layout change, e.g. on window resize.
  useLayoutEffect(() => {
    if (!isOpen || !overlayRef.current || !targetRef.current || !boundaryElement) {
      return;
    }

    return positioner.subscribe(
      {
        targetNode: targetRef.current,
        overlayNode: overlayRef.current,
        scrollNode: scrollRef.current || overlayRef.current,
        boundaryElement
      },
      updatePosition
    );
    // oxlint-disable-next-line react/react-compiler
  }, [positioner, isOpen, overlayRef, targetRef, scrollRef, boundaryElement, updatePosition]);

  // Reposition the overlay and do not close on scroll while the visual viewport is resizing.
  // This will ensure that overlays adjust their positioning when the iOS virtual keyboard appears.
  let isResizing = useRef(false);
  useLayoutEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    let onResize = () => {
      isResizing.current = true;
      clearTimeout(timeout);

      timeout = setTimeout(() => {
        isResizing.current = false;
      }, 500);

      updatePosition();
    };

    // Only reposition the overlay if a scroll event happens immediately as a result of resize (aka the virtual keyboard has appears)
    // We don't want to reposition the overlay if the user has pinch zoomed in and is scrolling the viewport around.
    let onScroll = () => {
      if (isResizing.current) {
        onResize();
      }
    };

    visualViewport?.addEventListener('resize', onResize);
    visualViewport?.addEventListener('scroll', onScroll);
    let cleanup = addEvent(
      // @ts-expect-error
      getPropagationTargets(window),
      'scroll',
      onScroll
    );
    return () => {
      visualViewport?.removeEventListener('resize', onResize);
      visualViewport?.removeEventListener('scroll', onScroll);
      cleanup();
    };
  }, [updatePosition]);

  let close = useCallback(() => {
    if (!isResizing.current) {
      onClose?.();
    }
  }, [onClose, isResizing]);

  // When scrolling a parent scrollable region of the trigger (other than the body),
  // we hide the popover. Otherwise, its position would be incorrect.
  useCloseOnScroll({
    triggerRef: targetRef,
    isOpen,
    onClose: onClose && close
  });

  return {
    overlayProps: {
      style: {
        position: position ? positioner.position : 'fixed',
        top: !position ? 0 : undefined,
        left: !position ? 0 : undefined,
        zIndex: 100000, // should match the z-index in ModalTrigger
        ...position?.position,
        maxHeight: position?.maxHeight ?? '100vh'
      }
    },
    placement: position?.placement ?? null,
    triggerAnchorPoint: position?.triggerAnchorPoint ?? null,
    arrowProps: {
      'aria-hidden': 'true',
      role: 'presentation',
      style: {
        left: position?.arrowOffsetLeft,
        top: position?.arrowOffsetTop
      }
    },
    updatePosition
  };
}

function translateRTL(position, direction) {
  if (direction === 'rtl') {
    return position.replace('start', 'right').replace('end', 'left');
  }
  return position.replace('start', 'left').replace('end', 'right');
}
