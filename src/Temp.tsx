import { action, atom } from "@/axtore";

import { useValue } from "@/axtore/react";

const [getCount, setCount] = atom(0);
// create an axtore action
const incrementAsync = action((steps) => setCount((prev) => prev + steps));
const App = () => {
  const count = useValue(getCount);
  // retrieve and action dispatching info
  const {
    // there is an error while dispatching
    hasError,
    // the action dispatches successfully
    hasValue,
    // not dispatch yet
    isIdle,
    // ids dispatching
    isLoading,
    // a string presents current dispatching status: idle/error/loading/success
    status,
    // a action dispatching result
    value,
    // an error of dispatching
    error,
  } = useValue(incrementAsync);

  return (
    <>
      <h1>{count}</h1>
      {isLoading && <div>Dispatching...</div>}
      <button onClick={() => incrementAsync(2)}>Increment</button>
    </>
  );
};
