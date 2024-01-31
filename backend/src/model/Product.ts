import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { Tag } from "./Tag";

export class Product {
  key: ProductKey;
  name: string | undefined;
  description: string | undefined;
  tags: Tag[] | undefined;

  constructor(
    orgId: string,
    id: string,
    name: string | undefined,
    description: string | undefined,
    tags: Tag[] | undefined,
  ) {
    this.key = new ProductKey(orgId, id);
    this.name = name;
    this.description = description;
    this.tags = tags;
  }

  toAttributeValues(): Record<string, AttributeValue> {
    return {
      ...this.key.toAttributeValues(),
      ...(this.name && { name: { S: this.name } }),
      ...(this.description && { description: { S: this.description } }),
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
      ...(this.tags && { tags: this.tags.map((tag) => tag.toApiModel()) }),
    };
  }

  static fromApiModel(orgId: string, parsedProduct: any): Product {
    return new Product(
      orgId,
      parsedProduct["id"],
      parsedProduct["name"],
      parsedProduct["description"],
      parsedProduct["tags"]?.map((tag) => new Tag(tag["name"], tag["value"])),
    );
  }

  static fromAttributeValues(
    attrs: Record<string, AttributeValue> | undefined,
  ): Product | undefined {
    if (attrs === undefined) {
      return undefined;
    } else {
      return new Product(
        attrs["orgId"].S!,
        attrs["id"].S!,
        attrs["name"].S,
        attrs["description"]?.S,
        attrs["tags"].L?.map((tag) => new Tag(tag.M!.name.S!, tag.M!.value.S!)),
      );
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

  toApiModel() {
    return {
      id: this.id,
    };
  }
}
