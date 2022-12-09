import { atom } from "@/axtore";
import { useValue } from "@/axtore/react";

const [getCount, setCount] = atom(0);

const CounterActions = () => {
  const handleClick = () => {
    setCount((count) => count + 1);
  };

  return <button onClick={handleClick}>Increase</button>;
};

const CounterValue = () => {
  const count = useValue(getCount);

  return <h2>{count}</h2>;
};

const CounterApp = () => {
  return (
    <>
      <h1>Counter</h1>
      <CounterValue />
      <CounterActions />
    </>
  );
};

export default CounterApp;
