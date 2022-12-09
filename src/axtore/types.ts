export type NoInfer<T> = [T][T extends any ? 0 : never];

export type VoidFunction = () => void;

export type AnyFunction = (...args: any[]) => any;

export type AtomGetter<T> = Observable<T> & (() => T);

export type AtomSetter<T> = { snapshot(): VoidFunction } & T;

export type CompareFn<T = unknown> = (a: T, b: T) => boolean;

export type Listener<T = void> = (e: T) => void;

export type Listenable<T = void> = (listener: Listener<T>) => VoidFunction;

export type Observable<T = unknown> = {
  getValue(): T;
  onChange(listener: Listener<T>): VoidFunction;
};

export type ConcurrencyResolver = (
  context: ActionContext
) => (next: VoidFunction) => void;

export type ExecutionInfo<T> = { result: T; error?: unknown };

export type Awaitable<T> = T extends Promise<infer P>
  ? P
  : T extends Listenable<infer L>
  ? L
  : T extends Action<any[], infer A>
  ? A
  : T;

export type ActionContext = {
  when<T>(
    listenable: Listenable<T> | Action<any[], T> | Promise<T>
  ): CancellablePromise<T>;
  delay(ms?: number): CancellablePromise<void>;
  readonly data: Record<string, any>;
  readonly onSuccess: Listenable<unknown>;
  readonly onDone: Listenable<ExecutionInfo<unknown>>;
  readonly onCancel: Listenable;
  readonly onCancelling: Listenable;
  readonly onError: Listenable;
  readonly abortController?: AbortController;
  race<T extends Record<string, unknown | undefined>>(
    values: T
  ): Promise<{
    [key in keyof T]?: Awaitable<T[key]>;
  }>;
  all<T extends Record<string, unknown | undefined>>(
    values: T
  ): Promise<{
    [key in keyof T]: Awaitable<T[key]>;
  }>;
};

export type LoadableStatus = "idle" | "success" | "error" | "loading";

export type Setter<T> = (value: T | ((prev: T) => T)) => void;

export type Atom<T, S = Setter<T>> = [AtomGetter<T>, AtomSetter<S>];

export type MutableLoadable<T = unknown> = {
  value: T;
  status: LoadableStatus;
  promise?: Promise<unknown>;
  error?: unknown;
  isLoading: boolean;
  isIdle: boolean;
  hasValue: boolean;
  hasError: boolean;
};

export type Loadable<T = unknown> = Readonly<MutableLoadable<T>>;

export type Action<A extends any[], R, T = ""> = Observable<
  Loadable<R extends Promise<infer P> ? P : R>
> & {
  displayName: string | undefined;
  once(...args: A): Action<A, R, T>;
  snapshot(): VoidFunction;
  cancel(): void;
  readonly onError: Listenable<unknown>;
  readonly onCancel: Listenable;
  readonly onSuccess: Listenable<R extends Promise<infer P> ? P : R>;
  readonly onDone: Listenable<
    ExecutionInfo<R extends Promise<infer P> ? P : R>
  >;
  (...args: A): R extends Promise<infer P> ? CancellablePromise<P> : R;
} & (T extends "member"
    ? {
        remove(...key: A): void;
      }
    : {
        family(...key: A): Action<[], R, "member">;
        removeAll(): void;
      });

export type AtomOptions<T> = {
  hydration?: Hydration;
  validate?: (value: T) => void;
  onChange?: (value: T) => void;
};

export type AtomUpdater<T, S> = (
  getValue: () => T,
  setValue: (value: T) => void
) => S;

export type AtomOptionsWithUpdater<T, S> = AtomOptions<T> & {
  update: AtomUpdater<T, S>;
};

export type ActionOptions<A extends any[], T> = {
  name?: string;
  hydrate?: Hydration;
  validate?: (...args: A) => void;
  onChange?: Listener<Loadable<T>>;
  onError?: Listener<unknown>;
  onCancel?: Listener;
  onDone?: Listener;
  onSuccess?: Listener<T>;
  concurrency?: ConcurrencyResolver;
};

export type ActionBody<A extends any[], R> = (
  ...args: A
) => R | ((context: ActionContext) => R);

export type CancellablePromise<T> = Promise<T> & { cancel(): void };

export type DehydrationValue = { value: any; family?: [any[], any][] };

export type Hydration = {
  readonly getValue: () => DehydrationValue | undefined;
  readonly onChange?: Listener<DehydrationValue>;
};

export type DehydrationValues<T extends string> = Record<T, DehydrationValue>;
