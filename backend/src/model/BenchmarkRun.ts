import { type AttributeValue } from "@aws-sdk/client-dynamodb";

import { type ApiBenchmarkResult } from "./BenchmarkResult";
import { Tag } from "./Tag";

export class BenchmarkRun {
  key: BenchmarkRunKey;
  tags: Tag[] | undefined;

  constructor(
    orgId: string,
    benchmarkId: string,
    executedOn: number,
    tags: Tag[] | undefined,
  ) {
    this.key = new BenchmarkRunKey(orgId, benchmarkId, executedOn);
    this.tags = tags;
  }

  toAttributeValues(): Record<string, AttributeValue> {
    const hasTags = this.tags != null;
    return {
      ...this.key.toAttributeValues(),
      ...(hasTags && {
        tags: { L: this.tags.map((tag) => tag.toMapAttributeValue()) },
      }),
    };
  }

  static fromApiModel(orgId: string, abr: ApiBenchmarkResult): BenchmarkRun {
    return new BenchmarkRun(
      orgId,
      abr.benchmarkId,
      abr.executedOn,
      abr.tags.map((apiTag) => Tag.fromApiModel(apiTag)),
    );
  }

  static fromAttributeValues(
    attrs: Record<string, AttributeValue> | undefined,
  ): BenchmarkRun | undefined {
    if (attrs?.fullRunId.S != null && attrs?.executedOn.N != null) {
      const idSplits = attrs.fullRunId.S.split("#");
      return new BenchmarkRun(
        idSplits[0],
        idSplits[1],
        parseInt(attrs.executedOn.N),
        attrs.tags.L?.flatMap((tag) => Tag.fromAttributeValues(tag.M)),
      );
    }
  }
}

export class BenchmarkRunKey {
  orgId: string;
  benchmarkId: string;
  executedOn: number;

  constructor(orgId: string, benchmarkId: string, executedOn: number) {
    this.orgId = orgId;
    this.benchmarkId = benchmarkId;
    this.executedOn = executedOn;
  }

  toAttributeValues(): Record<string, AttributeValue> {
    return {
      fullRunId: { S: this.orgId + "#" + this.benchmarkId },
      executedOn: { N: "" + this.executedOn },
    };
  }
}
