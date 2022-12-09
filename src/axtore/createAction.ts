import {
  Action,
  ActionBody,
  ActionContext,
  ActionOptions,
  AnyFunction,
  ConcurrencyResolver,
  ExecutionInfo,
  Listener,
  Loadable,
  LoadableStatus,
  MutableLoadable,
  NoInfer,
} from "./types";
import { CallbackGroup, createCallbackGroup } from "./createCallbackGroup";

import { ArrayKeyedMap } from "./ArrayKeyedMap";
import { atom } from "./createAtom";
import { delay } from "./async";
import { isPromiseLike } from "./isPromiseLike";

const getStatuses = (
  status: LoadableStatus,
  value?: any,
  error?: any
): Pick<
  Loadable<unknown>,
  | "status"
  | "value"
  | "error"
  | "hasValue"
  | "hasError"
  | "isIdle"
  | "isLoading"
  | "promise"
> => {
  return {
    status,
    value,
    error,
    promise: undefined,
    hasValue: status === "success",
    hasError: status === "error",
    isLoading: status === "loading",
    isIdle: status === "idle",
  };
};

export type CreateAction = {
  <A extends any[], R>(
    action: ActionBody<A, R>,
    options?: NoInfer<ActionOptions<A, R extends Promise<infer P> ? P : R>>
  ): Action<A, R>;
  <A extends any[], R>(
    action: ActionBody<A, R>,
    concurrency: ConcurrencyResolver
  ): Action<A, R>;

  (): Action<[], void>;

  <T>(): Action<[arg: T], T>;
};

const defaultAction = (payload: unknown) => payload;

const isAction = <T>(value: unknown | undefined): value is Action<any[], T> => {
  return typeof value === "function" && (value as any).__action;
};

const isCancellable = (
  value: unknown | undefined
): value is { cancel(): void } => {
  return typeof (value as any)?.cancel === "function";
};

const createAction: CreateAction = (
  fn: AnyFunction = defaultAction,
  options?: ActionOptions<any[], any> | ConcurrencyResolver
): any => {
  if (!options) {
    options = {};
  }

  if (typeof options === "function") {
    options = { concurrency: options };
  }
  let prevValue: any;

  const {
    concurrency,
    hydrate: hydration,
    name,
    validate,
    onCancel,
    onDone,
    onError,
    onChange,
    onSuccess,
  } = options;

  const dehydratedValue = hydration?.getValue();
  const [getValue, setValue] = atom<MutableLoadable<any>>(getStatuses("idle"), {
    hydration: hydration
      ? {
          getValue: () => dehydratedValue?.value,
          onChange: (value) =>
            hydration.onChange &&
            hydration.onChange({
              value,
              family: context.family
                ?.entries()
                .map(([k, v]) => [k, v.getValue()]),
            }),
        }
      : undefined,
  });

  const handleAsync = <T extends Record<string, unknown | undefined>>(
    type: "race" | "all",
    values: T
  ) => {
    const cleanup = createCallbackGroup();
    context.onCleanup(cleanup.invokeAndClear);

    return Object.assign(
      new Promise<any>((resolve, reject) => {
        const promises: Promise<any>[] = [];
        let done = false;
        let doneCount = 0;
        const result: Record<keyof T, any> = {} as any;
        const keys = Object.keys(values);
        const handleSuccess = (key: keyof T, value: unknown) => {
          if (done) return;
          doneCount++;
          result[key] = value;

          if (type === "race") {
            done = true;
            cleanup.invokeAndClear();
          } else {
            done = doneCount >= keys.length;
          }

          if (done) {
            cleanup.invokeAndClear();
            resolve(result);
          }
        };
        const handleError = (error: unknown) => {
          if (done) return;
          cleanup.invokeAndClear();
          reject(error);
        };

        keys.forEach((key) => {
          const value = values[key];
          if (isCancellable(value)) {
            cleanup(() => value.cancel());
          }
          if (isPromiseLike(value)) {
            value
              .then((resolved) => handleSuccess(key, resolved))
              .catch(handleError);
            promises.push(value);
          } else if (typeof value === "function") {
            when(value)
              .then((resolved) => handleSuccess(key, resolved))
              .catch(handleError);
          } else {
            handleSuccess(key, value);
          }
        });
      }),
      { cancel: cleanup.invokeAndClear }
    );
  };

  const when = (listenable: any) => {
    if (isPromiseLike(listenable)) {
      let cancelled = false;
      const originalCancel = (listenable as any).cancel as
        | VoidFunction
        | undefined;
      const cleanup = context.onCleanup(() => {
        cancelled = true;
      });
      return Object.assign(
        new Promise((resolve, reject) => {
          listenable
            .then((resolved) => {
              if (cancelled) return;
              cleanup();
              resolve(resolved);
            })
            .catch((rejected) => {
              if (cancelled) return;
              cleanup();
              reject(rejected);
            });
        }),
        {
          cancel() {
            if (cancelled) return;
            cancelled = true;
            originalCancel?.();
            cleanup();
          },
        }
      );
    }
    const subscribe = isAction(listenable) ? listenable.onChange : listenable;
    let promiseResolve: Function | undefined;
    const unsubscribe = subscribe((payload: any) => promiseResolve?.(payload));
    return Object.assign(
      new Promise<any>((resolve) => {
        promiseResolve = resolve;
        context.onCleanup(unsubscribe);
      }),
      { cancel: unsubscribe }
    );
  };

  let context: ActionContext & {
    dispatches: number;
    onCleanup: CallbackGroup;
    onSuccess: CallbackGroup;
    onError: CallbackGroup;
    onDone: CallbackGroup;
    onCancel: CallbackGroup;
    onCancelling: CallbackGroup;
    family?: ArrayKeyedMap<Action<any[], any>, unknown[]>;
  } = {
    data: {},
    dispatches: 0,
    onSuccess: createCallbackGroup(),
    onError: createCallbackGroup(),
    onDone: createCallbackGroup(),
    onCancel: createCallbackGroup(),
    onCancelling: createCallbackGroup(),
    onCleanup: createCallbackGroup(),
    race: (values) => handleAsync("race", values),
    all: (values) => handleAsync("all", values),
    when,
    delay: (ms) => when(delay(ms)),
  };

  const cancel = () => {
    context.onCancelling.invoke();
    if (getValue().status !== "loading") return;
    setValue(prevValue);
    context.onCancel.invoke();
    context.onCleanup.invokeAndClear();
  };

  const internalInvoke = (...args: any[]): any => {
    if (validate) {
      (validate as Function)(...args);
    }

    let currentValue = getValue();
    prevValue = currentValue;
    context.dispatches++;

    try {
      // cleanup event subscriptions
      context.onSuccess.clear();
      context.onError.clear();
      context.onDone.clear();
      context.onCancel.clear();
      context.onCleanup.invokeAndClear();

      if (onCancel) context.onCancel(onCancel);
      if (onSuccess) context.onCancel(onSuccess);
      if (onError) context.onCancel(onError);
      if (onDone) context.onCancel(onDone);

      let result = fn(...args);

      if (typeof result === "function") {
        result = result(context);
      }

      if (isPromiseLike(result)) {
        const promise = result;
        const originalCancel = (result as any).cancel as
          | VoidFunction
          | undefined;
        const wrappedPromise = Object.assign(
          new Promise((resolve, reject) => {
            promise
              .then((value) => {
                console.log("resolved", value);
                // something is changed since last time
                if (currentValue !== getValue()) return;
                setValue({
                  ...currentValue,
                  ...getStatuses("success", value),
                });
                context.onSuccess.invoke(value);
                context.onDone.invoke({
                  result: value,
                } as ExecutionInfo<unknown>);
                context.onCleanup.invokeAndClear();
                resolve(value);
              })
              .catch((reason) => {
                // something is changed since last time
                if (currentValue !== getValue()) return;
                setValue({
                  ...currentValue,
                  ...getStatuses("error", undefined, reason),
                });
                context.onError.invoke(reason);
                context.onDone.invoke({
                  error: reason,
                } as ExecutionInfo<unknown>);
                context.onCleanup.invokeAndClear();
                if (!context.onError.size()) {
                  reject(reason);
                }
              });
          }),
          {
            cancel() {
              originalCancel?.();
              if (currentValue !== getValue()) return;
              cancel();
            },
          }
        );
        setValue(
          (currentValue = {
            ...currentValue,
            ...getStatuses("loading", currentValue.value),
            promise: wrappedPromise,
          })
        );

        return wrappedPromise;
      }
      setValue({
        ...currentValue,
        ...getStatuses("success", result),
      });
      context.onSuccess.invoke(result);
      context.onDone.invoke({ result } as ExecutionInfo<unknown>);
      context.onCleanup.invokeAndClear();
      return result;
    } catch (error) {
      setValue({
        ...currentValue,
        ...getStatuses("error", undefined, error),
      });
      context.onError.invoke(error);
      context.onDone.invoke({ error } as ExecutionInfo<unknown>);
      context.onCleanup.invokeAndClear();
      if (!context.onError.size()) {
        throw error;
      }
    }
  };

  const invoke = concurrency
    ? (...args: any[]) => {
        concurrency(context)(() => internalInvoke(...args));
        const loadable = getValue();
        return loadable.promise || loadable.value;
      }
    : internalInvoke;

  if (onChange) {
    getValue.onChange(onChange);
  }

  return Object.assign(invoke, {
    // mark this object is action
    __action: true,

    displayName: name || fn.name,

    getValue,

    onChange: getValue.onChange,

    onSuccess: (listener: Listener<unknown>) => context.onSuccess(listener),

    onError: (listener: Listener<unknown>) => context.onError(listener),

    onDone: (listener: Listener<ExecutionInfo<unknown>>) =>
      context.onDone(listener),

    onCancel: (listener: Listener) => context.onCancel(listener),

    once(...args: any[]) {
      if (!context.dispatches) {
        invoke(...args);
      }
      return this;
    },

    family(...keys: any[]) {
      let family = context.family;
      if (!family) {
        family = new ArrayKeyedMap();
        context.family = family;
      }

      return family.getOrAdd(keys, () =>
        Object.assign(
          createAction(() => fn(...keys), {
            hydrate: dehydratedValue?.family
              ? {
                  getValue: () => {
                    const memberValue = dehydratedValue?.family?.find(([x]) =>
                      x.every((v, i) => v === keys[i])
                    );
                    return { value: memberValue?.[1] };
                  },
                  onChange: (value) => {
                    if (!hydration?.onChange) return;
                    hydration.onChange({
                      value,
                      family: context.family
                        ?.entries()
                        .map(([key, a]) => [key, a.getValue()]),
                    });
                  },
                }
              : undefined,
          }),
          {
            remove() {
              family?.delete(keys);
            },
          }
        )
      );
    },

    remove(...keys: any[]) {
      context.family?.delete(keys);
    },

    removeAll() {
      context.family?.clear();
    },

    snapshot: () => {
      const prevContext = context;

      context = {
        ...context,
        family: context.family?.clone(),
        data: { ...context.data },
        onSuccess: context.onSuccess.clone(),
        onError: context.onError.clone(),
        onDone: context.onDone.clone(),
        onCancel: context.onCancel.clone(),
        onCancelling: context.onCancelling.clone(),
        onCleanup: context.onCleanup.clone(),
      };

      const revertState = (setValue.snapshot as Function)((state: any) => ({
        ...state,
        onSuccess: state.onSuccess.clone(),
        onError: state.onError.clone(),
        onDone: state.onDone.clone(),
        onCancel: state.onCancel.clone(),
      }));

      return () => {
        context = prevContext;
        revertState();
      };
    },
    cancel,
  });
};

export { createAction as action };
