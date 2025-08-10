import {Rect} from '@react-types/shared';

export function getScrollPort(scrollView: HTMLElement): Rect {
  let {
    scrollPaddingTop,
    scrollPaddingRight,
    scrollPaddingBottom,
    scrollPaddingLeft
  } = getComputedStyle(scrollView);

  return {
    x: scrollView.scrollLeft + (parseInt(scrollPaddingLeft, 10) || 0),
    y: scrollView.scrollTop + (parseInt(scrollPaddingTop, 10) || 0),
    width: scrollView.clientWidth - (parseInt(scrollPaddingRight, 10) || 0),
    height: scrollView.clientHeight - (parseInt(scrollPaddingBottom, 10) || 0)
  };
}

export function getSnapArea(element: HTMLElement): Rect {
  let {x, y, width, height} = element.getBoundingClientRect();
  let style = getComputedStyle(element);

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
