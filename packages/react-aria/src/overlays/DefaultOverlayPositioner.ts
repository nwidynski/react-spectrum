/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import {calculatePosition, PositionOpts, PositionResult} from './calculatePosition';
import {DOMAnchorBox, DOMResizableBox} from '../utils/layout';
import {getActiveElement, isFocusWithin} from '../utils/shadowdom/DOMFunctions';
import {getOwnerDocument, getOwnerWindow} from '../utils/domHelpers';
import {OverlayPositioner, SubscribeOpts} from './useOverlayPosition';

interface ScrollAnchor {
  type: 'top' | 'bottom';
  offset: number;
}

/**
 * Calculates the position of an overlay in JavaScript, and writes it to the overlay's styles.
 */
export class DefaultOverlayPositioner implements OverlayPositioner {
  readonly position = 'absolute';

  update(opts: PositionOpts): PositionResult | null {
    let overlay = opts.overlayNode as HTMLElement;
    let scrollNode = opts.scrollNode;
    let activeElement = getActiveElement();

    // Record the offset of the focused element from the nearer scroll container edge. Restoring it
    // keeps the focused element visually in place when the overlay height changes.
    let anchor: ScrollAnchor | null = null;

    if (activeElement != null && isFocusWithin(scrollNode)) {
      let anchorRect = activeElement.getBoundingClientRect();
      let scrollRect = scrollNode.getBoundingClientRect();

      let topOffset = anchorRect.top - scrollRect.top;
      let bottomOffset = anchorRect.bottom - scrollRect.bottom;

      anchor =
        topOffset > scrollRect.height / 2
          ? {type: 'bottom', offset: bottomOffset}
          : {type: 'top', offset: topOffset};
    }

    // Reset the previous max height if the user does not set one.
    // RAC collections populate after a second render and need a new max height then.
    if (!opts.maxHeight) {
      let viewportHeight = window.visualViewport?.height ?? window.innerHeight;

      overlay.style.top = '0px';
      overlay.style.bottom = '';
      overlay.style.maxHeight = `${viewportHeight}px`;
    }

    let result = calculatePosition(opts);

    // Write styles directly so positioning happens without a second render.
    // This way, autoFocus scrolling and preventScroll for popovers need no delay.
    for (let side of ['top', 'right', 'bottom', 'left']) {
      let value = result.position[side];
      overlay.style[side] = value != null ? `${value}px` : '';
    }

    overlay.style.maxHeight = result.maxHeight != null ? `${result.maxHeight}px` : '';

    if (anchor != null && activeElement != null) {
      let anchorRect = activeElement.getBoundingClientRect();
      let scrollRect = scrollNode.getBoundingClientRect();
      let offset = anchorRect[anchor.type] - scrollRect[anchor.type];

      scrollNode.scrollTop += offset - anchor.offset;
    }

    return result;
  }

  subscribe(opts: SubscribeOpts, updatePosition: () => void): () => void {
    let target = opts.targetNode as HTMLElement;
    let overlay = opts.overlayNode;
    let boundary = opts.boundaryElement;

    let ownerWindow = getOwnerWindow(target);
    let ownerDocument = getOwnerDocument(target);

    // Fall back to window resize events in environments without ResizeObserver, e.g. jsdom.
    if (typeof ownerWindow.ResizeObserver === 'undefined') {
      ownerWindow.addEventListener('resize', updatePosition, false);
      return () => ownerWindow.removeEventListener('resize', updatePosition, false);
    }

    // The viewport box covers the default boundary, so observe only a custom one.
    let isCustomBoundary =
      boundary !== ownerDocument.body && boundary !== ownerDocument.documentElement;

    let targetBox = new DOMAnchorBox(target);
    let overlayBox = new DOMResizableBox(overlay);
    let viewportBox = new DOMResizableBox(ownerDocument);
    let boundaryBox = isCustomBoundary ? new DOMResizableBox(boundary) : null;

    targetBox.addEventListener('react-aria-boxchange', updatePosition);
    overlayBox.addEventListener('react-aria-boxchange', updatePosition);
    viewportBox.addEventListener('react-aria-boxchange', updatePosition);
    boundaryBox?.addEventListener('react-aria-boxchange', updatePosition);

    return () => {
      targetBox.removeEventListener('react-aria-boxchange', updatePosition);
      overlayBox.removeEventListener('react-aria-boxchange', updatePosition);
      viewportBox.removeEventListener('react-aria-boxchange', updatePosition);
      boundaryBox?.removeEventListener('react-aria-boxchange', updatePosition);
    };
  }
}
