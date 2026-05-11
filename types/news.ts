export type StructuredAnalysis = {
  macro: string;
  public: string;
  international: string;
};

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  label: string;
  time: string;
  accent: string;
  presetAnalysis?: StructuredAnalysis;
};
