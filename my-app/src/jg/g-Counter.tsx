import { useState } from "react";
export function Counter() {
  const [count, setCount] = useState(0);

  const handleOnClick = () => {
    setCount((current) => current + 1);
  };

  return (
    <div>
    <span>
      {("Count: " + count)}
    </span>
    <button onClick={handleOnClick}>
      {"+"}
    </button>
    </div>
  );
}
