import type * as React from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      text: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
      list: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

export {};
