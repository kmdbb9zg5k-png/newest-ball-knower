import 'react';

declare module 'react' {
  function cloneElement<P = any>(
    element: React.ReactElement<P>,
    props?: any,
    ...children: React.ReactNode[]
  ): React.ReactElement<P>;
}
