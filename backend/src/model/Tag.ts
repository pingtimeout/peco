import { AttributeValue } from "@aws-sdk/client-dynamodb";

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

  toApiModel() {
    return {
      name: this.name,
      value: this.value,
    }
  }
}
