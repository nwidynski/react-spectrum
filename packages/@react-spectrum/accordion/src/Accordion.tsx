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

import {AriaLabelingProps, DOMProps, DOMRef, StyleProps} from '@react-types/shared';
import {Button, DisclosureGroup, DisclosureGroupProps, DisclosurePanelProps, DisclosureProps, Heading, Disclosure as RACDisclosure, DisclosurePanel as RACDisclosurePanel} from 'react-aria-components';
import ChevronLeftMedium from '@spectrum-icons/ui/ChevronLeftMedium';
import ChevronRightMedium from '@spectrum-icons/ui/ChevronRightMedium';
import {classNames, useDOMRef, useStyleProps} from '@react-spectrum/utils';
import React, {createContext, forwardRef} from 'react';
import styles from '@adobe/spectrum-css-temp/components/accordion/vars.css';
import {useLocale} from '@react-aria/i18n';
import {useProviderProps} from '@react-spectrum/provider';

export interface SpectrumAccordionProps extends Omit<DisclosureGroupProps, 'className' | 'style' | 'children'>, StyleProps, DOMProps {
  /** Whether the Accordion should be displayed with a quiet style. */
  isQuiet?: boolean,
  /** The disclosures within the accordion group. */
  children: React.ReactNode
}

const InternalAccordionContext = createContext<{isQuiet: boolean} | null>(null);

function Accordion(props: SpectrumAccordionProps, ref: DOMRef<HTMLDivElement>) {
  props = useProviderProps(props);
  let {styleProps} = useStyleProps(props);
  let domRef = useDOMRef(ref);
  return (
    <InternalAccordionContext.Provider value={{isQuiet: props.isQuiet || false}}>
      <DisclosureGroup
        {...props}
        {...styleProps}
        ref={domRef}
        className={classNames(styles, 'spectrum-Accordion', styleProps.className)}>
        {props.children}
      </DisclosureGroup>
    </InternalAccordionContext.Provider>
  );
}

export interface SpectrumDisclosureProps extends Omit<DisclosureProps, 'className' | 'style' | 'children'>, AriaLabelingProps, StyleProps {
  /** Whether the Disclosure should be displayed with a quiet style. */
  isQuiet?: boolean,
  /** The contents of the disclosure. The first child should be the header, and the second child should be the panel. */
  children: React.ReactNode
}

function Disclosure(props: SpectrumDisclosureProps, ref: DOMRef<HTMLDivElement>) {
  props = useProviderProps(props);
  let {styleProps} = useStyleProps(props);
  let domRef = useDOMRef(ref);
  let accordionContext = React.useContext(InternalAccordionContext)!;
  return (
    <RACDisclosure
      {...props}
      {...styleProps}
      ref={domRef}
      className={({isExpanded, isDisabled}) => classNames(styles, 'spectrum-Accordion-item', {
        'spectrum-Accordion-item--quiet': accordionContext?.isQuiet ?? props.isQuiet,
        'is-expanded': isExpanded,
        'is-disabled': isDisabled,
        'in-accordion': accordionContext != null
      }, styleProps.className)}>
      {props.children}
    </RACDisclosure>
  );
}

export interface SpectrumDisclosurePanelProps extends Omit<DisclosurePanelProps, 'className' | 'style' | 'children'>, DOMProps, AriaLabelingProps, StyleProps {
  /** The contents of the accordion panel. */
  children: React.ReactNode
}

function DisclosurePanel(props: SpectrumDisclosurePanelProps, ref: DOMRef<HTMLDivElement>) {
  let {styleProps} = useStyleProps(props);
  let domRef = useDOMRef(ref);
  return (
    <RACDisclosurePanel
      ref={domRef}
      {...styleProps as Omit<React.HTMLAttributes<HTMLElement>, 'role'>}
      className={classNames(styles, 'spectrum-Accordion-itemContent', styleProps.className)} 
      {...props}>
      {props.children}
    </RACDisclosurePanel>
  );
}

export interface SpectrumDisclosureHeaderProps extends DOMProps, AriaLabelingProps, StyleProps {
  /**
   * The heading level of the disclosure header.
   * @default 3
   */
  level?: number,
  /** The contents of the disclosure header. */
  children: React.ReactNode
}

function DisclosureHeader(props: SpectrumDisclosureHeaderProps, ref: DOMRef<HTMLHeadingElement>) {
  let {styleProps} = useStyleProps(props);
  let {level = 3} = props;
  let {direction} = useLocale();
  let domRef = useDOMRef(ref);
  return (
    <Heading ref={domRef} level={level} {...styleProps} className={classNames(styles, 'spectrum-Accordion-itemHeading', styleProps.className)}>
      <Button
        slot="trigger"
        className={({isHovered, isFocusVisible, isPressed}) => classNames(styles, 'spectrum-Accordion-itemHeader', {
          'is-hovered': isHovered,
          'is-pressed': isPressed,
          'focus-ring': isFocusVisible
        })}>
        {direction === 'ltr' ? (
          <ChevronRightMedium
            aria-hidden="true"
            UNSAFE_className={classNames(styles, 'spectrum-Accordion-itemIndicator')} />
              ) : (
                <ChevronLeftMedium
                  aria-hidden="true"
                  UNSAFE_className={classNames(styles, 'spectrum-Accordion-itemIndicator')} />
              )}
        {props.children}
      </Button>
    </Heading>
  );
}

/** A group of disclosures that can be expanded and collapsed. */
const _Accordion = forwardRef(Accordion) as (props: SpectrumAccordionProps & {ref?: DOMRef<HTMLDivElement>}) => ReturnType<typeof Accordion>;
export {_Accordion as Accordion};

/** A collapsible section of content composed of a heading that expands and collapses a panel. */
const _Disclosure = forwardRef(Disclosure) as (props: SpectrumDisclosureProps & {ref?: DOMRef<HTMLDivElement>}) => ReturnType<typeof Disclosure>;
export {_Disclosure as Disclosure};

/** The panel that contains the content of an disclosure. */
const _DisclosurePanel = forwardRef(DisclosurePanel) as (props: SpectrumDisclosurePanelProps & {ref?: DOMRef<HTMLDivElement>}) => ReturnType<typeof DisclosurePanel>;
export {_DisclosurePanel as DisclosurePanel};

/** The heading of the disclosure. */
const _DisclosureHeader = forwardRef(DisclosureHeader) as (props: SpectrumDisclosureHeaderProps & {ref?: DOMRef<HTMLDivElement>}) => ReturnType<typeof DisclosureHeader>;
export {_DisclosureHeader as DisclosureHeader};
