import { type AttributeValue } from "@aws-sdk/client-dynamodb";

export class Tag {
  name: string;
  value: string;

  constructor(name: string, value: string) {
    this.name = name;
    this.value = value;
  }

  toMapAttributeValue(): AttributeValue {
    return {
      M: {
        name: { S: this.name },
        value: { S: this.value },
      },
    };
  }

  toApiModel(): { name: string; value: string } {
    return {
      name: this.name,
      value: this.value,
    };
  }

  static fromAttributeValues(
    attrs: Record<string, AttributeValue> | undefined,
  ): Tag[] {
    if (attrs?.name.S != null && attrs?.value.S != null) {
      return [new Tag(attrs.name.S, attrs.value.S)];
    } else {
      return [];
    }
  }
}

export interface ApiTag {
  name: string;
  value: string;
}
