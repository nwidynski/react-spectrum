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

import {Button, Carousel, Tab, TabList, TabPanel} from '../';
import {Meta, StoryFn, StoryObj} from '@storybook/react';
import React from 'react';
import './styles.css';
import {Circle} from 'lucide-react';

export default {
  title: 'React Aria Components/Carousel',
  component: Carousel
} as Meta<typeof Carousel>;

export type CarouselStory = StoryFn<typeof Carousel>;
export type CarouselStoryObj = StoryObj<typeof Carousel>;

export const CarouselExample: CarouselStory = (args) => {
  let items: {id: string, name: string}[] = [];
  for (let i = 0; i < 100; i++) {
    items.push({id: `item_${i}`, name: `Item ${i}`});
  }
  
  return (
    <Carousel {...args}>
      <Button slot="play">Play</Button>
      <Button slot="previous">Previous</Button>
      <Button slot="next">Next</Button>

      <TabList
        items={items}
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 8,
          width: 100,
          padding: 8,
          overflow: 'auto'
        }}>
        {(item) => (
          <Tab id={item.id} style={({isSelected}) => ({color: isSelected ? 'black' : 'lightgray', lineHeight: 0, borderRadius: 24})}>
            <span aria-hidden="true" style={{display: 'inline-block', lineHeight: 0}}>
              <Circle size={12} fill="currentColor" />
            </span>
          </Tab>
        )}
      </TabList>

      {items.map((item) => (
        <TabPanel id={item.id} key={item.id} />
      ))}
    </Carousel>
  );
};

CarouselExample.story = {
  args: {
  },
  argTypes: {
  }
};
