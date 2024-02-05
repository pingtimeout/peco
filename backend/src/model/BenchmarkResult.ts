import { type ApiTag } from "./Tag";

export interface ApiBenchmarkResult {
  benchmarkId: string;
  executedOn: number;
  metrics: ApiMetricValue[];
  tags: ApiTag[];
}

export interface ApiMetricValue {
  metricDefinitionId: string;
  value: number;
}
