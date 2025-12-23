declare module 'react-joyride' {
  import type { ComponentType, ReactNode } from 'react';

  export interface Step {
    target: string;
    title?: ReactNode;
    content?: ReactNode;
    disableBeacon?: boolean;
    placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
    spotlightClicks?: boolean;
  }

  export interface CallBackProps {
    action: string;
    index: number;
    status: string;
    type: string;
    lifecycle: string;
  }

  export const STATUS: {
    FINISHED: 'finished';
    SKIPPED: 'skipped';
    RUNNING: 'running';
    PAUSED: 'paused';
  };

  export interface JoyrideProps {
    steps: Step[];
    run?: boolean;
    continuous?: boolean;
    showSkipButton?: boolean;
    callback?: (data: CallBackProps) => void;
    styles?: Record<string, unknown>;
  }

  const Joyride: ComponentType<JoyrideProps>;

  export default Joyride;
}



