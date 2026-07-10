import type { LocalizedText } from "./language";

export type Category = {
  id: string;
  name: LocalizedText;
  description?: LocalizedText;
  order: number;
};
