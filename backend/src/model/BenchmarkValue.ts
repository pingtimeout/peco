import { type AttributeValue } from "@aws-sdk/client-dynamodb";

import {
  type ApiBenchmarkResult,
  type ApiMetricValue,
} from "./BenchmarkResult";

export class BenchmarkValue {
  key: BenchmarkValueKey;
  value: number;

  constructor(
    orgId: string,
    benchmarkId: string,
    metricDefinitionId: string,
    executedOn: number,
    value: number,
  ) {
    this.key = new BenchmarkValueKey(
      orgId,
      benchmarkId,
      metricDefinitionId,
      executedOn,
    );
    this.value = value;
  }

  toAttributeValues(): Record<string, AttributeValue> {
    return {
      value: { N: "" + this.value },
      ...this.key.toAttributeValues(),
    };
  }

  static fromApiModel(
    orgId: string,
    abr: ApiBenchmarkResult,
    amv: ApiMetricValue,
  ): BenchmarkValue {
    return new BenchmarkValue(
      orgId,
      abr.benchmarkId,
      amv.metricDefinitionId,
      abr.executedOn,
      amv.value,
    );
  }

  static fromAttributeValues(
    attrs: Record<string, AttributeValue> | undefined,
  ): BenchmarkValue | undefined {
    if (
      attrs?.fullValueId.S != null &&
      attrs?.executedOn.N != null &&
      attrs?.value.N != null
    ) {
      const idSplits = attrs.fullValueId.S.split("#");
      return new BenchmarkValue(
        idSplits[0],
        idSplits[1],
        idSplits[2],
        parseInt(attrs.executedOn.N),
        parseInt(attrs.value.N),
      );
    }
  }
}

export class BenchmarkValueKey {
  orgId: string;
  benchmarkId: string;
  metricDefinitionId: string;
  executedOn: number;

  constructor(
    orgId: string,
    benchmarkId: string,
    metricDefinitionId: string,
    executedOn: number,
  ) {
    this.orgId = orgId;
    this.benchmarkId = benchmarkId;
    this.metricDefinitionId = metricDefinitionId;
    this.executedOn = executedOn;
  }

  toAttributeValues(): Record<string, AttributeValue> {
    return {
      fullValueId: {
        S: this.orgId + "#" + this.benchmarkId + "#" + this.metricDefinitionId,
      },
      executedOn: { N: "" + this.executedOn },
    };
  }
}
