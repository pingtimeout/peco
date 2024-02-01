import { type AttributeValue } from "@aws-sdk/client-dynamodb";

import { type ApiTag, Tag } from "./Tag";

export class BenchmarkDefinition {
  key: BenchmarkDefinitionKey;
  useCaseId: string;
  environmentId: string;
  productId: string;
  jenkinsJobUrl: string | undefined;
  tags: Tag[] | undefined;
  lastUploadedTimestamp: number;

  constructor(
    orgId: string,
    id: string,
    useCaseId: string,
    environmentId: string,
    productId: string,
    jenkinsJobUrl: string | undefined,
    tags: Tag[] | undefined,
    lastUploadedTimestamp: number,
  ) {
    this.key = new BenchmarkDefinitionKey(orgId, id);
    this.useCaseId = useCaseId;
    this.environmentId = environmentId;
    this.productId = productId;
    this.jenkinsJobUrl = jenkinsJobUrl;
    this.tags = tags;
    this.lastUploadedTimestamp = lastUploadedTimestamp;
  }

  toAttributeValues(): Record<string, AttributeValue> {
    const hasJenkinsJobUrl = this.jenkinsJobUrl != null;
    const hasTags = this.tags != null;
    return {
      ...this.key.toAttributeValues(),
      ...{ useCaseId: { S: this.useCaseId } },
      ...{ environmentId: { S: this.environmentId } },
      ...{ productId: { S: this.productId } },
      ...(hasJenkinsJobUrl && { jenkinsJobUrl: { S: this.jenkinsJobUrl } }),
      ...(hasTags && {
        tags: { L: this.tags.map((tag) => tag.toMapAttributeValue()) },
      }),
      ...{ lastUploadedTimestamp: { N: "" + this.lastUploadedTimestamp } },
    };
  }

  toApiModel(): ApiBenchmarkDefinition {
    const hasJenkinsJobUrl = this.jenkinsJobUrl != null;
    const hasTags = this.tags != null;
    return {
      ...this.key.toApiModel(),
      ...{ useCaseId: this.useCaseId },
      ...{ environmentId: this.environmentId },
      ...{ productId: this.productId },
      ...(hasJenkinsJobUrl && { jenkinsJobUrl: this.jenkinsJobUrl }),
      ...(hasTags && { tags: this.tags.map((tag) => tag.toApiModel()) }),
      ...{ lastUploadedTimestamp: this.lastUploadedTimestamp },
    };
  }

  static fromApiModel(
    orgId: string,
    parsedBenchmarkDefinition: ApiBenchmarkDefinition,
    lastUploadedTimestamp: number,
  ): BenchmarkDefinition {
    return new BenchmarkDefinition(
      orgId,
      parsedBenchmarkDefinition.id,
      parsedBenchmarkDefinition.useCaseId,
      parsedBenchmarkDefinition.environmentId,
      parsedBenchmarkDefinition.productId,
      parsedBenchmarkDefinition.jenkinsJobUrl,
      parsedBenchmarkDefinition.tags?.map(
        (tag) => new Tag(tag.name, tag.value),
      ),
      lastUploadedTimestamp,
    );
  }

  static fromAttributeValues(
    attrs: Record<string, AttributeValue> | undefined,
  ): BenchmarkDefinition | undefined {
    if (
      attrs?.orgId.S != null &&
      attrs?.id.S != null &&
      attrs?.useCaseId.S != null &&
      attrs?.environmentId.S != null &&
      attrs?.productId.S != null
    ) {
      return new BenchmarkDefinition(
        attrs.orgId.S,
        attrs.id.S,
        attrs.useCaseId.S,
        attrs.environmentId.S,
        attrs.productId.S,
        attrs.jenkinsJobUrl?.S,
        attrs.tags.L?.flatMap((tag) => Tag.fromAttributeValues(tag.M)),
        parseInt(attrs.lastUploadedTimestamp.N ?? "0"),
      );
    }
  }
}

export class BenchmarkDefinitionKey {
  orgId: string;
  id: string;

  constructor(orgId: string, id: string) {
    this.orgId = orgId;
    this.id = id;
  }

  toAttributeValues(): Record<string, AttributeValue> {
    return {
      orgId: { S: this.orgId },
      id: { S: this.id },
    };
  }

  toApiModel(): ApiBenchmarkDefinitionKey {
    return {
      id: this.id,
    };
  }
}

interface ApiBenchmarkDefinitionKey {
  id: string;
}

export interface ApiBenchmarkDefinition {
  id: string;
  useCaseId: string;
  environmentId: string;
  productId: string;
  jenkinsJobUrl: string | undefined;
  tags: ApiTag[] | undefined;
  lastUploadedTimestamp: number;
}
