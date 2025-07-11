/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import {Item} from '@react-stately/collections';
import React, {JSX} from 'react';
import {Select} from './example';
import {StoryObj} from '@storybook/react';

const meta = {
  title: 'useSelect'
};

export default meta;

export type TemplateStory = StoryObj<typeof Select>;

let lotsOfItems: any[] = [];
for (let i = 0; i < 50; i++) {
  lotsOfItems.push({name: 'Item ' + i});
}

const Template = (): JSX.Element => (
  <Select label="Example" items={lotsOfItems}>
    {(item: any) => <Item key={item.name}>{item.name}</Item>}
  </Select>
);

export const ScrollTesting: TemplateStory = {
  render: (args) => <Template {...args} />
};
