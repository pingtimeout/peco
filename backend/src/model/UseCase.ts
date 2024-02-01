import { type AttributeValue } from "@aws-sdk/client-dynamodb";

import { type ApiTag, Tag } from "./Tag";

export class UseCase {
  key: UseCaseKey;
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
    this.key = new UseCaseKey(orgId, id);
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

  toApiModel(): ApiUseCase {
    return {
      name: this.name,
      description: this.description,
      tags: this.tags.map((tag) => tag.toApiModel()),
      ...this.key.toApiModel(),
    };
  }

  static fromApiModel(orgId: string, parsedUseCase: ApiUseCase): UseCase {
    return new UseCase(
      orgId,
      parsedUseCase.id,
      parsedUseCase.name,
      parsedUseCase.description,
      parsedUseCase.tags?.map((tag) => new Tag(tag.name, tag.value)),
    );
  }

  static fromAttributeValues(
    attrs: Record<string, AttributeValue> | undefined,
  ): UseCase | undefined {
    if (
      attrs?.orgId.S != null &&
      attrs?.id.S != null &&
      attrs?.name.S != null &&
      attrs?.description.S != null &&
      attrs?.tags.L != null
    ) {
      return new UseCase(
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

  toApiModel(): ApiUseCaseKey {
    return {
      id: this.id,
    };
  }
}

interface ApiUseCaseKey {
  id: string;
}

export interface ApiUseCase {
  id: string;
  name: string;
  description: string;
  tags: ApiTag[];
}
