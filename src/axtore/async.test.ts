import { expect, it } from "vitest";

import { action } from "./createAction";
import { delay } from "./async";

it("when()", async () => {
  const clicked = action();
  let count = 0;

  const doSomething = action(() => async ({ when }) => {
    await when(clicked);
    count++;
  });

  doSomething();
  expect(count).toBe(0);
  clicked();
  await delay();
  expect(count).toBe(1);
});

it("delay() cancel before it is resolved", async () => {
  let count = 0;
  const doSomething = action(() => async ({ delay }) => {
    await delay(10);
    count++;
  });

  doSomething();
  expect(count).toBe(0);
  doSomething.cancel();
  await delay(15);
  expect(count).toBe(0);
});

it("race()", async () => {
  const doSomething = action(() => async ({ race }) => {
    const result = await race({
      v1: delay(10).then(() => 1),
      v2: delay(5).then(() => 2),
    });
    return result;
  });
  const result = await doSomething();
  expect(result).toEqual({ v2: 2 });
});

it("all()", async () => {
  const doSomething = action(() => async ({ all }) => {
    const result = await all({
      v1: delay(10).then(() => 1),
      v2: delay(5).then(() => 2),
    });
    return result;
  });
  const result = await doSomething();
  expect(result).toEqual({ v1: 1, v2: 2 });
});

it("all() all cancellable objects must be cancelled if action is cancelled", async () => {
  let cancelled = false;
  let unsubscribed = false;

  const doSomething = action(() => async ({ all }) => {
    await all({
      v1: delay(10),
      v2: Object.assign(delay(5), {
        cancel() {
          cancelled = true;
        },
      }),
      v3: () => () => {
        unsubscribed = true;
      },
    });
  });

  doSomething();
  expect(cancelled).toBeFalsy();
  doSomething.cancel();
  await delay(15);
  expect(cancelled).toBeTruthy();
  expect(unsubscribed).toBeTruthy();
});
