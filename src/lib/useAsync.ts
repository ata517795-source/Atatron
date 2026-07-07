import { useEffect, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'ok'; data: T }
  | { status: 'error' };

/** Tiny async-data hook: loading / ok / error, ignores stale resolutions. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    fn().then(
      (data) => alive && setState({ status: 'ok', data }),
      () => alive && setState({ status: 'error' }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}
