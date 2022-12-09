import * as React from "react";

import { CompareFn, Loadable, Observable } from "./types";

import { createCallbackGroup } from "./createCallbackGroup";
import { defaultEqual } from "./compare";

export type UseObservableHook = {
  /**
   * bind component to observable object and return its value
   */
  <T>(observable: Observable<T>): T;

  /**
   * bind component to observable object and return its value
   */
  <T, S>(
    observable: Observable<T>,
    selector: (state: T) => S,
    compareFn?: CompareFn<S>
  ): S;

  /**
   * bind component to observable object and return its value
   */
  <O extends Observable<any>[], S>(
    observables: O,
    selector: (states: {
      [key in keyof O]: O[key] extends Observable<infer T> ? T : never;
    }) => S,
    compareFn?: CompareFn<S>
  ): S;
};

const effectHook = React.useEffect;

const useValue: UseObservableHook = (
  observable: Observable | Observable[],
  selector?: Function,
  compareFn?: Function
): any => {
  const prevStateRef = React.useRef<unknown>();
  const compareFnRef = React.useRef<Function>();
  const selectorRef = React.useRef<Function>();
  const errorRef = React.useRef<unknown>();
  const rerender = React.useState<unknown>()[1];

  compareFnRef.current = compareFn;
  selectorRef.current = selector;

  effectHook(() => {
    const unsubscribe = createCallbackGroup();
    const handleChange = () => {
      try {
        const nextState = Array.isArray(observable)
          ? observable.map((x) => x.getValue())
          : observable.getValue();
        const selectiveNextState = selectorRef.current
          ? selectorRef.current(nextState)
          : nextState;
        const isEqual = compareFnRef.current
          ? compareFnRef.current(selectiveNextState, prevStateRef.current)
          : defaultEqual(selectiveNextState, prevStateRef.current);
        if (isEqual) return;
      } catch (ex) {
        // handle error throwing outside rendering phase
        errorRef.current = ex;
      }
      rerender({});
    };

    (Array.isArray(observable) ? observable : [observable]).forEach((o) =>
      o.onChange(handleChange)
    );
    return unsubscribe.invoke;
  }, [...(Array.isArray(observable) ? observable : [observable]), rerender]);

  if (errorRef.current) {
    const e = errorRef.current;
    errorRef.current = undefined;
    throw e;
  }

  const state = Array.isArray(observable)
    ? observable.map((x) => x.getValue())
    : observable.getValue();
  const selectiveState = selector ? selector(state) : state;
  prevStateRef.current = selectiveState;

  return selectiveState;
};

const syncValue = <T>(loadable: Loadable<T>) => {
  if (loadable.isLoading) throw loadable.promise;
  if (loadable.hasError) throw loadable.error;
  return loadable.value;
};

export { useValue, syncValue };
