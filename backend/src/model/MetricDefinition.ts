import { type AttributeValue } from "@aws-sdk/client-dynamodb";

import { type ApiTag, Tag } from "./Tag";

export class MetricDefinition {
  key: MetricDefinitionKey;
  name: string;
  description: string;
  unit: string;
  regressionDirection: string;
  tags: Tag[];

  constructor(
    orgId: string,
    id: string,
    name: string,
    description: string,
    unit: string,
    regressionDirection: string,
    tags: Tag[],
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
      name: { S: this.name },
      description: { S: this.description },
      unit: { S: this.unit },
      regressionDirection: { S: this.regressionDirection },
      tags: { L: this.tags.map((tag) => tag.toMapAttributeValue()) },
      ...this.key.toAttributeValues(),
    };
  }

  toApiModel(): ApiMetricDefinition {
    return {
      name: this.name,
      description: this.description,
      unit: this.unit,
      regressionDirection: this.regressionDirection,
      tags: this.tags.map((tag) => tag.toApiModel()),
      ...this.key.toApiModel(),
    };
  }

  static fromApiModel(
    orgId: string,
    parsedMetricDefinition: ApiMetricDefinition,
  ): MetricDefinition {
    return new MetricDefinition(
      orgId,
      parsedMetricDefinition.id,
      parsedMetricDefinition.name,
      parsedMetricDefinition.description,
      parsedMetricDefinition.unit,
      parsedMetricDefinition.regressionDirection,
      parsedMetricDefinition.tags.map((tag) => new Tag(tag.name, tag.value)),
    );
  }

  static fromAttributeValues(
    attrs: Record<string, AttributeValue> | undefined,
  ): MetricDefinition | undefined {
    if (
      attrs?.orgId.S != null &&
      attrs?.id.S != null &&
      attrs?.name.S != null &&
      attrs?.description.S != null &&
      attrs?.unit.S != null &&
      attrs?.regressionDirection.S != null &&
      attrs?.tags.L != null
    ) {
      return new MetricDefinition(
        attrs.orgId.S,
        attrs.id.S,
        attrs.name.S,
        attrs.description.S,
        attrs.unit.S,
        attrs.regressionDirection.S,
        attrs.tags.L?.flatMap((tag) => Tag.fromAttributeValues(tag.M)),
      );
    } else {
      return undefined;
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

  toApiModel(): ApiMetricDefinitionKey {
    return {
      id: this.id,
    };
  }
}

interface ApiMetricDefinitionKey {
  id: string;
}

export interface ApiMetricDefinition {
  id: string;
  name: string;
  description: string;
  unit: string;
  regressionDirection: string;
  tags: ApiTag[];
}
