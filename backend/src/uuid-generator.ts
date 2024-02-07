// @prettier

import short from "short-uuid";

export const generateUuid = (): string => {
  return short.generate();
};
