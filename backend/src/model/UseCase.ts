import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { Tag } from "./Tag";

export class UseCase {
  key: UseCaseKey;
  name: string | undefined;
  description: string | undefined;
  tags: Tag[] | undefined;

  constructor(
    orgId: string,
    id: string,
    name: string | undefined,
    description: string | undefined,
    tags: Tag[] | undefined
  ) {
    this.key = new UseCaseKey(orgId, id);
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

  static fromApiModel(orgId: string, parsedUseCase: any): UseCase {
    return new UseCase(
      orgId,
      parsedUseCase["id"],
      parsedUseCase["name"],
      parsedUseCase["description"],
      parsedUseCase["tags"]?.map((tag) => new Tag(tag["name"], tag["value"]))
    );
  }

  static fromAttributeValues(
    attrs: Record<string, AttributeValue> | undefined
  ): UseCase | undefined {
    if (attrs === undefined) {
      return undefined;
    } else {
      return new UseCase(
        attrs["orgId"].S!,
        attrs["id"].S!,
        attrs["name"].S,
        attrs["description"]?.S,
        attrs["tags"].L?.map((tag) => new Tag(tag.M!.name.S!, tag.M!.value.S!))
      );
    }
  }
}

export class UseCaseKey {
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
