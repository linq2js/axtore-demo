import { NoInfer } from "@/axtore";

export type RestOptions = { body?: unknown };

const BASE_URL = "https://pokeapi.co/api/v2/";

const resolveOption = <P, O>(
  payload: P,
  options: O | ((payload: P) => O)
): O => {
  if (typeof options === "function") {
    return (options as Function)(payload) as O;
  }
  return options;
};

const rest =
  <T = unknown, P = void>(
    method: "get" | "post" | "put",
    endpoint: string | NoInfer<(payload: P) => string>,
    options?: RestOptions | NoInfer<(payload: P) => RestOptions>
  ) =>
  async (payload: P): Promise<T> => {
    options = resolveOption(payload, options);
    endpoint = resolveOption(payload, endpoint);

    const { body } = options || {};
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      body: typeof body === "undefined" ? undefined : JSON.stringify(body),
    });
    const data = res.json();
    return data as unknown as T;
  };

export { rest };
