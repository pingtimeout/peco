import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { Tag } from "./Tag";

export class BenchmarkDefinition {
  key: BenchmarkDefinitionKey;
  useCaseId: string;
  environmentId: string;
  productId: string;
  jenkinsJobUrl: string | undefined;
  tags: Tag[] | undefined;
  lastUpdatedOn: number;

  constructor(
    orgId: string,
    id: string,
    useCaseId: string,
    environmentId: string,
    productId: string,
    jenkinsJobUrl: string | undefined,
    tags: Tag[] | undefined,
    lastUpdatedOn: number,
  ) {
    this.key = new BenchmarkDefinitionKey(orgId, id);
    this.useCaseId = useCaseId;
    this.environmentId = environmentId;
    this.productId = productId;
    this.jenkinsJobUrl = jenkinsJobUrl;
    this.tags = tags;
    this.lastUpdatedOn = lastUpdatedOn;
  }

  toAttributeValues(): Record<string, AttributeValue> {
    return {
      ...this.key.toAttributeValues(),
      ...{ useCaseId: { S: this.useCaseId } },
      ...{ environmentId: { S: this.environmentId } },
      ...{ productId: { S: this.productId } },
      ...(this.jenkinsJobUrl && { jenkinsJobUrl: { S: this.jenkinsJobUrl } }),
      ...(this.tags && {
        tags: { L: this.tags.map((tag) => tag.toMapAttributeValue()) },
      }),
      ...{ lastUpdatedOn: { N: "" + this.lastUpdatedOn } },
    };
  }

  toApiModel() {
    return {
      ...this.key.toApiModel(),
      ...{ useCaseId: this.useCaseId },
      ...{ environmentId: this.environmentId },
      ...{ productId: this.productId },
      ...(this.jenkinsJobUrl && { jenkinsJobUrl: this.jenkinsJobUrl }),
      ...(this.tags && { tags: this.tags.map((tag) => tag.toApiModel()) }),
      ...{ lastUpdatedOn: this.lastUpdatedOn },
    };
  }

  static fromApiModel(
    orgId: string,
    parsedBenchmarkDefinition: any,
    lastUpdatedOn: number,
  ): BenchmarkDefinition {
    return new BenchmarkDefinition(
      orgId,
      parsedBenchmarkDefinition["id"],
      parsedBenchmarkDefinition["useCaseId"],
      parsedBenchmarkDefinition["environmentId"],
      parsedBenchmarkDefinition["productId"],
      parsedBenchmarkDefinition["jenkinsJobUrl"],
      parsedBenchmarkDefinition["tags"]?.map(
        (tag) => new Tag(tag["name"], tag["value"])
      ),
      lastUpdatedOn,
    );
  }

  static fromAttributeValues(
    attrs: Record<string, AttributeValue> | undefined
  ): BenchmarkDefinition | undefined {
    if (attrs === undefined) {
      return undefined;
    } else {
      return new BenchmarkDefinition(
        attrs["orgId"].S!,
        attrs["id"].S!,
        attrs["useCaseId"].S!,
        attrs["environmentId"].S!,
        attrs["productId"].S!,
        attrs["jenkinsJobUrl"]?.S,
        attrs["tags"].L?.map((tag) => new Tag(tag.M!.name.S!, tag.M!.value.S!)),
        parseInt(attrs["lastUpdatedOn"].N!),
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

  toApiModel() {
    return {
      id: this.id,
    };
  }
}
