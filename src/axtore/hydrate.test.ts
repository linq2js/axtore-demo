import { expect, it } from "vitest";

import { action } from "./createAction";
import { hydrate } from "./hydrate";

it("hydration: single action", () => {
  let expectedDehydratedValues: any;
  const hydrationOf = hydrate({
    values: {
      test: {
        value: { value: { value: 1 } },
      },
    },
    onChange(e) {
      expectedDehydratedValues = e;
    },
  });
  const doSomething = action(() => 2, { hydrate: hydrationOf("test") });
  expect(doSomething.getValue().value).toBe(1);
  // invoke
  doSomething();
  expect(expectedDehydratedValues).toEqual({
    test: {
      family: undefined,
      value: {
        value: {
          error: undefined,
          status: "success",
          hasError: false,
          hasValue: true,
          isIdle: false,
          isLoading: false,
          promise: undefined,
          value: 2,
        },
      },
    },
  });
});

it("hydration: action family", () => {
  let expectedDehydratedValues: any;
  const hydrationOf = hydrate({
    values: {
      test: {
        value: {
          value: { value: 1 },
        },
        family: [
          [[1, 2], { value: { value: 3 } }],
          [[2, 2], { value: { value: 4 } }],
        ],
      },
    },
    onChange(e) {
      expectedDehydratedValues = e;
    },
  });
  const doSomething = action((a: number, b: number) => a + b, {
    hydrate: hydrationOf("test"),
  });
  expect(doSomething.family(1, 2).getValue().value).toBe(3);
  expect(doSomething.family(2, 2).getValue().value).toBe(4);
  expect(doSomething.family(2, 3).getValue().value).toBeUndefined();
  doSomething.family(2, 3)();
  expect(doSomething.family(2, 3).getValue().value).toBe(5);
  expect(expectedDehydratedValues.test.family[2][1].value).toBe(5);
});
