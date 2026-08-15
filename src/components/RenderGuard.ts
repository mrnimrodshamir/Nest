import React from 'react';

interface RenderGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  resetKey?: string;
}

interface RenderGuardState {
  failed: boolean;
}

/** A narrow error boundary for optional native/content surfaces.
 * Event content must remain readable even if one optional renderer rejects a
 * provider value. Native event-handler errors still need their own guards. */
export class RenderGuard extends React.Component<RenderGuardProps, RenderGuardState> {
  state: RenderGuardState = { failed: false };

  static getDerivedStateFromError(): RenderGuardState {
    return { failed: true };
  }

  componentDidUpdate(previous: RenderGuardProps): void {
    if (this.state.failed && previous.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  componentDidCatch(error: unknown): void {
    console.log('[RenderGuard] optional Event section omitted', error instanceof Error ? error.message : 'render error');
  }

  render(): React.ReactNode {
    return this.state.failed ? this.props.fallback ?? null : this.props.children;
  }
}
