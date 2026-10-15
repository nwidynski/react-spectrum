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

import {clamp} from 'react-stately/private/utils/number';
import {DOMAnchorBox, DOMBox, DOMResizableBox} from '../utils/layout';
import {getContainingElement} from '../utils/layoutHelpers';
import {getOwnerDocument, getOwnerWindow} from '../utils/domHelpers';
import {OverlayPositioner, PlacementAxis, SizeAxis, SubscribeOpts} from './useOverlayPosition';
import {PositionOpts, PositionResult} from './calculatePosition';

const FLIPPED_DIRECTION: Record<string, PlacementAxis> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left'
};

const SHRINK_FALLBACK = Object.freeze(`
  @position-try --react-aria-shrink {
    max-height: min(
      calc(100% - var(--react-aria-container-padding, 0px)),
      var(--react-aria-max-height, 100vh)
    );
  }
`);

/**
 * Places an overlay with native CSS anchor positioning.
 *
 * The browser flips and shifts the overlay and moves it on scroll, but does not report the result.
 * A `DOMAnchorBox` observes the overlay, and the placement is read back for the arrow,
 * `data-placement` and origin-aware animations.
 *
 * Not supported yet: `crossOffset`, `boundaryElement` and `getTargetRect`. The overlay always flips
 * against its containing block. An overflowing start or end aligned overlay stays within the
 * containing block, but ignores the container padding.
 */
export class AnchorOverlayPositioner implements OverlayPositioner {
  private static count = 0;
  private static documents = new WeakSet<Document>();

  private anchorNames = new WeakMap<Element, string>();

  readonly position = 'fixed';

  update(opts: PositionOpts): PositionResult | null {
    let target = opts.targetNode as HTMLElement;
    let overlay = opts.overlayNode as HTMLElement;
    let ownerWindow = getOwnerWindow(overlay);

    // useOverlayPosition already translates start and end into left and right.
    let placements = opts.placement.split(' ') as PlacementAxis[];
    let placement = placements[0];
    let crossPlacement = placements[1] ?? 'center';

    let isVertical = placement === 'top' || placement === 'bottom';
    let flip = isVertical ? 'flip-block' : 'flip-inline';

    // A single keyword spans the full cross axis and centers on the anchor.
    // A "span-*" keyword aligns the overlay to one target edge and grows away from it.
    let spanSide = FLIPPED_DIRECTION[crossPlacement];
    let area = spanSide != null ? `${placement} span-${spanSide}` : placement;

    // Prefer the requested side at full height, then the opposite side, then shrink.
    let fallbacks = opts.shouldFlip
      ? `${flip}, --react-aria-shrink, --react-aria-shrink ${flip}`
      : '--react-aria-shrink';

    this.connect(target);

    // Write styles directly so the overlay is placed without a second render.
    // This also clears the styles that disconnect() kept when the overlay last closed.
    overlay.style.removeProperty('max-height');
    overlay.style.setProperty('position-anchor', this.anchorNames.get(target)!);
    overlay.style.setProperty('position-area', area);
    overlay.style.setProperty('position-try-fallbacks', fallbacks);
    overlay.style.setProperty('--react-aria-container-padding', `${opts.padding}px`);

    if (opts.maxHeight != null) {
      overlay.style.setProperty('--react-aria-max-height', `${opts.maxHeight}px`);
    } else {
      overlay.style.removeProperty('--react-aria-max-height');
    }

    // Insets shrink the position-area cell, so offset and container padding are insets. They flip
    // with the placement, and margins stay with the overlay's own styles. The far-side inset stays
    // auto, because Chromium does not reliably re-evaluate fallbacks on scroll when it is set.
    // The shrink fallback applies that padding instead.
    let position: PositionResult['position'] = {};
    for (let side of ['top', 'right', 'bottom', 'left']) {
      let value = side === FLIPPED_DIRECTION[placement] ? opts.offset : opts.padding;

      if (side === placement) {
        overlay.style.removeProperty(side);
      } else {
        position[side] = value;
        overlay.style.setProperty(side, `${value}px`);
      }
    }

    // Reading rects forces layout, which resolves the applied fallback.
    // Measure without transforms, so an entering animation does not skew the arrow.
    let targetBox = new DOMBox(target, {transform: false});
    let overlayBox = new DOMBox(overlay, {transform: false});

    let targetRect = targetBox.boundingRect;
    let overlayRect = overlayBox.boundingRect;

    // The browser does not report the applied fallback, so read it back from position-area.
    let style = ownerWindow.getComputedStyle(overlay);
    let positionArea = style.getPropertyValue('position-area');
    let areaTokens = positionArea.split(' ');

    let appliedSide = areaTokens.find(token => token in FLIPPED_DIRECTION);
    let applied = (appliedSide as PlacementAxis | undefined) ?? placement;

    let isAppliedVertical = applied === 'top' || applied === 'bottom';
    let start: 'x' | 'y' = isAppliedVertical ? 'x' : 'y';
    let size: SizeAxis = isAppliedVertical ? 'width' : 'height';
    let crossSize: SizeAxis = isAppliedVertical ? 'height' : 'width';

    // Express the target's edges and center in the overlay's coordinate space.
    let targetStart = targetRect[start] - overlayRect[start];
    let targetEnd = targetStart + targetRect[size];
    let targetCenter = targetStart + targetRect[size] / 2;

    // Clamp the arrow like calculatePosition does, so it stays within both boxes.
    let half = opts.arrowSize / 2;
    let boundaryOffset = opts.arrowBoundaryOffset ?? 0;

    let arrow = clamp(targetCenter, targetStart + half, targetEnd - half);
    arrow = clamp(arrow, half + boundaryOffset, overlayRect[size] - half - boundaryOffset);

    let anchorPoint = targetStart;
    if (opts.arrowSize) {
      anchorPoint = arrow;
    } else if (crossPlacement === 'right' || crossPlacement === 'bottom') {
      anchorPoint = targetEnd;
    } else if (crossPlacement === 'center') {
      anchorPoint = targetCenter;
    }

    let isAppliedStart = applied === 'top' || applied === 'left';
    let crossAnchorPoint = isAppliedStart ? overlayRect[crossSize] : 0;

    return {
      position,
      arrowOffsetLeft: isAppliedVertical ? arrow : undefined,
      arrowOffsetTop: isAppliedVertical ? undefined : arrow,
      placement: applied,
      triggerAnchorPoint: {
        x: isAppliedVertical ? anchorPoint : crossAnchorPoint,
        y: isAppliedVertical ? crossAnchorPoint : anchorPoint
      }
    };
  }

  subscribe(opts: SubscribeOpts, updatePosition: () => void): () => void {
    let target = opts.targetNode as HTMLElement;
    let overlay = opts.overlayNode as HTMLElement;

    let targetBox = new DOMResizableBox(target);
    let overlayBox = new DOMAnchorBox(overlay);

    targetBox.addEventListener('react-aria-boxchange', updatePosition);
    overlayBox.addEventListener('react-aria-boxchange', updatePosition);

    return () => {
      targetBox.removeEventListener('react-aria-boxchange', updatePosition);
      overlayBox.removeEventListener('react-aria-boxchange', updatePosition);

      this.disconnect(target, overlay);
    };
  }

  private connect(target: HTMLElement) {
    let ownerWindow = getOwnerWindow(target);
    let ownerDocument = getOwnerDocument(target);

    if (!AnchorOverlayPositioner.documents.has(ownerDocument)) {
      let sheet = new ownerWindow.CSSStyleSheet();

      sheet.replaceSync(SHRINK_FALLBACK.trim());

      ownerDocument.adoptedStyleSheets.push(sheet);
      AnchorOverlayPositioner.documents.add(ownerDocument);
    }

    if (this.anchorNames.has(target)) {
      return;
    }

    let anchorName = `--react-aria-overlay-${++AnchorOverlayPositioner.count}`;

    // Append the name like DOMAnchorBox does, so other anchor names on the target survive.
    let style = ownerWindow.getComputedStyle(target);
    let currentName = style.getPropertyValue('anchor-name');
    let currentNames = currentName.split(',').map(name => name.trim());

    let filtered = currentNames.filter(name => name && name !== 'none');

    target.style.setProperty('anchor-name', filtered.concat(anchorName).join(', '));

    this.anchorNames.set(target, anchorName);
  }

  private disconnect(target: HTMLElement, overlay: HTMLElement) {
    let ownerWindow = getOwnerWindow(overlay);
    let anchorName = this.anchorNames.get(target);

    if (anchorName == null) {
      return;
    }

    // Freeze the overlay at static coordinates before the anchor name is removed.
    // This keeps exit animations in place.
    let style = ownerWindow.getComputedStyle(overlay);

    // A fixed overlay has no offset parent, but an ancestor may still be its containing block.
    let containingBlock = getContainingElement(overlay);

    let overlayBox = new DOMBox(overlay, {transform: false});
    let overlayRect = overlayBox.boundingRect;

    let marginTop = parseFloat(style.marginTop) || 0;
    let marginLeft = parseFloat(style.marginLeft) || 0;

    let top = overlayRect.top - marginTop;
    let left = overlayRect.left - marginLeft;

    if (containingBlock != null) {
      let containingBox = new DOMBox(containingBlock, {model: 'padding-box', transform: false});
      let containingRect = containingBox.boundingRect;

      top += containingBlock.scrollTop - containingRect.top;
      left += containingBlock.scrollLeft - containingRect.left;
    }

    // Keep the max height from the shrink fallback, because removing the fallbacks resets it.
    if (style.maxHeight !== 'none') {
      overlay.style.setProperty('max-height', style.maxHeight);
    }

    overlay.style.removeProperty('position-anchor');
    overlay.style.removeProperty('position-area');
    overlay.style.removeProperty('position-try-fallbacks');
    overlay.style.removeProperty('right');
    overlay.style.removeProperty('bottom');

    overlay.style.setProperty('top', `${top}px`);
    overlay.style.setProperty('left', `${left}px`);

    let currentName = target.style.getPropertyValue('anchor-name');
    let currentNames = currentName.split(',').map(name => name.trim());

    let filtered = currentNames.filter(name => name && name !== anchorName);

    if (filtered.length > 0) {
      target.style.setProperty('anchor-name', filtered.join(', '));
    } else {
      target.style.removeProperty('anchor-name');
    }

    this.anchorNames.delete(target);
  }
}
