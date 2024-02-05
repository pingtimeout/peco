import { type AttributeValue } from "@aws-sdk/client-dynamodb";

export class MetricValue {
  key: MetricValueKey;
  value: number;

  constructor(
    orgId: string,
    benchmarkId: string,
    metricDefinitionId: string,
    executedOn: number,
    value: number,
  ) {
    this.key = new MetricValueKey(
      orgId,
      benchmarkId,
      metricDefinitionId,
      executedOn,
    );
    this.value = value;
  }

  toMapAttributeValue(): Record<string, AttributeValue> {
    return {
      ...this.key.toAttributeValues(),
      value: { N: "" + this.value },
    };
  }

  static fromAttributeValues(
    attrs: Record<string, AttributeValue> | undefined,
  ): MetricValue[] {
    if (
      attrs?.fullValueId.S != null &&
      attrs?.executedOn.N != null &&
      attrs?.value.N != null
    ) {
      const idSplits = attrs.fullValueId.S.split("#");
      return [
        new MetricValue(
          idSplits[0],
          idSplits[1],
          idSplits[2],
          parseFloat(attrs.value.N),
          parseFloat(attrs.value.N),
        ),
      ];
    } else {
      return [];
    }
  }
}

export class MetricValueKey {
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
      fullRunId: {
        S: this.orgId + "#" + this.metricDefinitionId + "#" + this.benchmarkId,
      },
      executedOn: { N: "" + this.executedOn },
    };
  }
}
