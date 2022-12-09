import {
  Atom,
  AtomOptions,
  AtomOptionsWithUpdater,
  AtomUpdater,
  Listener,
  NoInfer,
} from "./types";

import { createCallbackGroup } from "./createCallbackGroup";

export type CreateAtom = {
  <T>(defaultValue: T, options?: NoInfer<AtomOptions<T>>): Atom<T>;

  <T, S>(defaultValue: T, update: AtomUpdater<T, S>): Atom<T, S>;

  <T, S>(defaultValue: T, options: NoInfer<AtomOptionsWithUpdater<T, S>>): Atom<
    T,
    S
  >;

  (): Atom<unknown>;
};

const createAtom: CreateAtom = (
  defaultValue?: any,
  options?:
    | (AtomOptions<unknown> & { update?: AtomUpdater<unknown, any> })
    | AtomUpdater<unknown, any>
): any => {
  if (!options) {
    options = {};
  }

  if (typeof options === "function") {
    options = { update: options };
  }

  const { validate, update, hydration } = options;

  let context = { value: defaultValue, onChange: createCallbackGroup() };

  if (hydration) {
    const dehydratedValue = hydration.getValue();
    if (dehydratedValue) {
      context.value = dehydratedValue.value;
    }
  }

  const getValue = () => context.value;
  let setValue = (nextValue: any) => {
    if (typeof nextValue === "function") {
      nextValue = nextValue(context.value);
    }

    if (context.value === nextValue) return;

    validate?.(nextValue);
    context.value = nextValue;

    if (hydration?.onChange) {
      hydration.onChange({ value: context.value });
    }

    context.onChange.invoke();
  };

  Object.assign(getValue, {
    getValue,
    onChange(listener: Listener) {
      return context.onChange(listener);
    },
  });

  if (update) {
    const originalSetValue = setValue;
    setValue = (...args: any[]) => {
      return update(getValue, originalSetValue)(...args);
    };
  }

  Object.assign(setValue, {
    __atom: true,

    snapshot(transformValueFn: Function) {
      const prevInfo = context;
      context = {
        ...context,
        value: transformValueFn
          ? transformValueFn(context.value)
          : context.value,
        onChange: context.onChange.clone(),
      };
      return () => {
        const hasChange = context.value !== prevInfo.value;
        context = prevInfo;
        if (hasChange) {
          context.onChange.invoke();
        }
      };
    },
  });

  return [getValue, setValue];
};

export { createAtom as atom };
