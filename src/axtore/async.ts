import { CancellablePromise, ConcurrencyResolver } from "./types";

const DEBOUNCE_CONFIGS_KEY = "$$debounce";
const THROTTLE_CONFIGS_KEY = "$$throttle";

const debounce =
  (ms: number): ConcurrencyResolver =>
  ({ data, onCancelling }) =>
  (next) => {
    const configs = data[DEBOUNCE_CONFIGS_KEY] as { timer: any } | undefined;
    clearTimeout(configs?.timer);

    onCancelling(() => {
      clearTimeout(configs?.timer);
    });

    data[DEBOUNCE_CONFIGS_KEY] = { timer: setTimeout(next, ms) };
  };

const throttle =
  (ms: number): ConcurrencyResolver =>
  ({ data }) =>
  (next) => {
    const configs = data[THROTTLE_CONFIGS_KEY] as
      | { nextExecution: number }
      | undefined;
    const now = Date.now();

    if (!configs || configs.nextExecution <= now) {
      data[THROTTLE_CONFIGS_KEY] = { nextExecution: now + ms };
      return next();
    }
  };

const delay = (ms: number = 0): CancellablePromise<void> => {
  let timer: any;

  return Object.assign(
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, ms);
    }),
    { cancel: () => clearTimeout(timer) }
  );
};

export { debounce, throttle, delay };
