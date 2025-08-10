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

import {Button, Collection, Group, Header, ListBox, ListBoxSection, ListLayout, Rotator, RotatorTab, RotatorTabList, Virtualizer} from '../';
import {Meta, StoryFn, StoryObj} from '@storybook/react';
import {MyListBoxItem} from './utils';
import React from 'react';
import styles from '../example/index.css';
import './styles.css';
import {Circle} from 'lucide-react';

export default {
  title: 'React Aria Components/Rotator',
  component: Rotator
} as Meta<typeof Rotator>;

export type RotatorStory = StoryFn<typeof Rotator>;
export type RotatorStoryObj = StoryObj<typeof Rotator>;

export const RotatorExample: RotatorStory = (args) => {
  let sections: {id: string, name: string, children: {id: string, name: string}[]}[] = [];
  for (let s = 0; s < 10; s++) {
    let items: {id: string, name: string}[] = [];
    for (let i = 0; i < 100; i++) {
      items.push({id: `item_${s}_${i}`, name: `Section ${s}, Item ${i}`});
    }
    sections.push({id: `section_${s}`, name: `Section ${s}`, children: items});
  }
  
  return (
    <Rotator {...args}>
      <Group>
        <Button slot="play">Play</Button>
        <Button slot="previous">Previous</Button>
        <Button slot="next">Next</Button>

        <ListBox items={sections} className={styles.menu} style={{height: 200}} aria-label="virtualized listbox">
          {section => (
            <ListBoxSection className={styles.group}>
              <Header id={`${section.id}-header`} style={{fontSize: '1.2em'}}>{section.name}</Header>
            </ListBoxSection>
            )}
        </ListBox>

        <Virtualizer
          layout={new ListLayout({
            estimatedRowHeight: 25,
            estimatedHeadingHeight: 26,
            loaderHeight: 30
          })}>
          <ListBox items={sections} className={styles.menu} style={{height: 400}} aria-label="virtualized listbox">
            {section => (
              <ListBoxSection className={styles.group}>
                <Header id={`${section.id}-header`} style={{fontSize: '1.2em'}}>{section.name}</Header>
                <Collection items={section.children}>
                  {item => <MyListBoxItem>{item.name}</MyListBoxItem>}
                </Collection>
              </ListBoxSection>
            )}
          </ListBox>
        </Virtualizer>

        <RotatorTabList
          items={sections}
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 8,
            width: 100,
            padding: 8,
            overflow: 'auto'
          }}>
          {() => (
            <RotatorTab style={({isSelected}) => ({color: isSelected ? 'black' : 'lightgray', lineHeight: 0, borderRadius: 24})}>
              <span aria-hidden="true" style={{display: 'inline-block', lineHeight: 0}}>
                <Circle size={12} fill="currentColor" />
              </span>
            </RotatorTab>
          )}
        </RotatorTabList>
      </Group>
    </Rotator>
  );
};

RotatorExample.story = {
  args: {
    allowScroll: true,
    rotationBehavior: 'auto'
  },
  argTypes: {
    rotationBehavior: {
      control: 'radio',
      options: ['auto', 'instant', 'smooth']
    },
    allowScroll: {
      control: 'boolean'
    }
  }
};
