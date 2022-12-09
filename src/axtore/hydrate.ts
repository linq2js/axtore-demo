import { DehydrationValues, Hydration, Listener, NoInfer } from "./types";

export type HydrationOptions<T extends string> = {
  values?: DehydrationValues<T>;
  onChange?: NoInfer<Listener<DehydrationValues<T>>>;
};

/**
 * @param options
 * @returns
 */
const hydrate = <T extends string = string>(
  options: HydrationOptions<T> = {}
) => {
  const { values, onChange } = options;
  const dehydratedValues = { ...values } as DehydrationValues<T>;

  return (key: T): Hydration => {
    return {
      getValue() {
        return dehydratedValues[key];
      },
      onChange(value) {
        if (!onChange) return;
        dehydratedValues[key] = value;
        onChange?.(dehydratedValues);
      },
    };
  };
};

export { hydrate };
