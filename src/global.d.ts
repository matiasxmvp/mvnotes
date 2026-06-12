/// <reference types="vite/client" />


import type { JSX as ReactJSX } from 'react';

export {};

// React 19 removed the global JSX namespace. Restore it for explicit return types.
declare global {
  namespace JSX {
    type Element                 = ReactJSX.Element;
    type IntrinsicElements       = ReactJSX.IntrinsicElements;
    type ElementAttributesProperty = ReactJSX.ElementAttributesProperty;
    type ElementChildrenAttribute  = ReactJSX.ElementChildrenAttribute;
    type IntrinsicAttributes       = ReactJSX.IntrinsicAttributes;
  }
}
