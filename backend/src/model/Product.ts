import { type AttributeValue } from "@aws-sdk/client-dynamodb";

import { type ApiTag, Tag } from "./Tag";

export class Product {
  key: ProductKey;
  name: string;
  description: string;
  tags: Tag[];

  constructor(
    orgId: string,
    id: string,
    name: string,
    description: string,
    tags: Tag[],
  ) {
    this.key = new ProductKey(orgId, id);
    this.name = name;
    this.description = description;
    this.tags = tags;
  }

  toAttributeValues(): Record<string, AttributeValue> {
    return {
      name: { S: this.name },
      description: { S: this.description },
      tags: { L: this.tags.map((tag) => tag.toMapAttributeValue()) },
      ...this.key.toAttributeValues(),
    };
  }

  toApiModel(): ApiProduct {
    return {
      name: this.name,
      description: this.description,
      tags: this.tags.map((tag) => tag.toApiModel()),
      ...this.key.toApiModel(),
    };
  }

  static fromApiModel(orgId: string, parsedProduct: ApiProduct): Product {
    return new Product(
      orgId,
      parsedProduct.id,
      parsedProduct.name,
      parsedProduct.description,
      parsedProduct.tags?.map((tag) => new Tag(tag.name, tag.value)),
    );
  }

  static fromAttributeValues(
    attrs: Record<string, AttributeValue> | undefined,
  ): Product | undefined {
    if (
      attrs?.orgId.S != null &&
      attrs?.id.S != null &&
      attrs?.name.S != null &&
      attrs?.description.S != null &&
      attrs?.tags.L != null
    ) {
      return new Product(
        attrs.orgId.S,
        attrs.id.S,
        attrs.name.S,
        attrs.description.S,
        attrs.tags.L.flatMap((tag) => Tag.fromAttributeValues(tag.M)),
      );
    } else {
      return undefined;
    }
  }
}

export class ProductKey {
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

  toApiModel(): ApiProductKey {
    return {
      id: this.id,
    };
  }
}

interface ApiProductKey {
  id: string;
}

export interface ApiProduct {
  id: string;
  name: string;
  description: string;
  tags: ApiTag[];
}
