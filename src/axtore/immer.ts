import produce from "immer";

const immer = <T extends {} | Array<any>>(
  getValue: () => T,
  setValue: (state: T) => void
) => (stateOrRecipe: T | ((draft: T) => void)) => {
  if (typeof stateOrRecipe === "function") {
    setValue((produce as Function)(getValue(), stateOrRecipe));
  } else {
    setValue(stateOrRecipe);
  }
};

export { immer };
