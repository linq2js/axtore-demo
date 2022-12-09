import { Pokemon } from "../types";
import { api } from "@/api";

const getPokemonByName = api<Pokemon, string>(
  "get",
  (name: string) => `pokemon/${name}`
);

export { getPokemonByName };
