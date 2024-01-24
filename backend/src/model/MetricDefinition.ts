import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { Tag } from "./Tag";

export class MetricDefinition {
  key: MetricDefinitionKey;
  name: string | undefined;
  description: string | undefined;
  unit: string;
  regressionDirection: string;
  tags: Tag[] | undefined;

  constructor(
    orgId: string,
    id: string,
    name: string | undefined,
    description: string | undefined,
    unit: string,
    regressionDirection: string,
    tags: Tag[] | undefined
  ) {
    this.key = new MetricDefinitionKey(orgId, id);
    this.name = name;
    this.description = description;
    this.unit = unit;
    this.regressionDirection = regressionDirection;
    this.tags = tags;
  }

  toAttributeValues(): Record<string, AttributeValue> {
    return {
      ...this.key.toAttributeValues(),
      ...(this.name && { name: { S: this.name } }),
      ...(this.description && { description: { S: this.description } }),
      ...{ unit: { S: this.unit } },
      ...{ regressionDirection: { S: this.regressionDirection } },
      ...(this.tags && {
        tags: { L: this.tags.map((tag) => tag.toMapAttributeValue()) },
      }),
    };
  }

  toApiModel() {
    return {
      ...this.key.toApiModel(),
      ...(this.name && { name: this.name }),
      ...(this.description && { description: this.description }),
      ...{ unit: this.unit },
      ...{ regressionDirection: this.regressionDirection },
      ...(this.tags && { tags: this.tags.map((tag) => tag.toApiModel()) }),
    };
  }

  static fromApiModel(
    orgId: string,
    parsedMetricDefinition: any
  ): MetricDefinition {
    return new MetricDefinition(
      orgId,
      parsedMetricDefinition["id"],
      parsedMetricDefinition["name"],
      parsedMetricDefinition["description"],
      parsedMetricDefinition["unit"],
      parsedMetricDefinition["regressionDirection"],
      parsedMetricDefinition["tags"]?.map(
        (tag) => new Tag(tag["name"], tag["value"])
      )
    );
  }

  static fromAttributeValues(
    attrs: Record<string, AttributeValue> | undefined
  ): MetricDefinition | undefined {
    if (attrs === undefined) {
      return undefined;
    } else {
      return new MetricDefinition(
        attrs["orgId"].S!,
        attrs["id"].S!,
        attrs["name"].S,
        attrs["description"]?.S,
        attrs["unit"].S!,
        attrs["regressionDirection"].S!,
        attrs["tags"].L?.map((tag) => new Tag(tag.M!.name.S!, tag.M!.value.S!))
      );
    }
  }
}

export class MetricDefinitionKey {
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
