import "aws-sdk-client-mock-jest";

import {
  ConditionalCheckFailedException,
  DeleteItemCommand,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  type APIGatewayProxyEvent,
  type APIGatewayProxyResult,
} from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";

import { handleAnyRequest } from "../../../src/handlers/use-case-crud";
import {
  test_rejection_if_missing_authorizer,
  test_rejection_if_missing_orgId,
  test_rejection_if_not_json_content_type,
} from "../handler-util";

jest.mock("../../../src/environment-variables", () => {
  const lazy = require("../../../src/lazy");
  return {
    __esModule: true,
    useCasesTableName: new lazy.Lazy(() => "MockUseCasesTable"),
  };
});

jest.mock("../../../src/uuid-generator", () => {
  const originalModule = jest.requireActual("../../../src/uuid-generator");
  return {
    __esModule: true,
    ...originalModule,
    generateUuid: jest.fn(() => "xsJQ5L5URaisxnyZmvpbuJ"),
  };
});

describe("Test handlePostRequest", () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    ddbMock.reset();
  });

  it("should reject queries using other than JSON content type", async () => {
    await test_rejection_if_not_json_content_type(
      ddbMock,
      handleAnyRequest,
      undefined,
      "POST",
    );
  });

  it("should reject queries with no authorizer", async () => {
    await test_rejection_if_missing_authorizer(
      ddbMock,
      handleAnyRequest,
      undefined,
      "POST",
    );
  });

  it("should reject queries with no orgId in claims", async () => {
    await test_rejection_if_missing_orgId(
      ddbMock,
      handleAnyRequest,
      undefined,
      "POST",
    );
  });

  it("should handle user-provided use-case without id", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      httpMethod: "POST",
      // @ts-expect-error
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      body: JSON.stringify({
        name: "the-name",
        description: "the-description",
        tags: [{ name: "the-tag-name", value: "the-tag-value" }],
      }),
    };

    const result = await handleAnyRequest(event as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(PutItemCommand, {
      TableName: "MockUseCasesTable",
      Item: {
        orgId: { S: "the-org-id" },
        id: { S: "use-xsJQ5L5URaisxnyZmvpbuJ" },
        name: { S: "the-name" },
        description: { S: "the-description" },
        tags: {
          L: [
            {
              M: {
                name: { S: "the-tag-name" },
                value: { S: "the-tag-value" },
              },
            },
          ],
        },
      },
    });
    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        name: "the-name",
        description: "the-description",
        tags: [{ name: "the-tag-name", value: "the-tag-value" }],
        id: "use-xsJQ5L5URaisxnyZmvpbuJ",
      }),
    });
  });

  it("should override user-provided use-case id", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      httpMethod: "POST",
      // @ts-expect-error
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      body: JSON.stringify({
        id: "the-id",
        name: "the-name",
        description: "the-description",
        tags: [{ name: "the-tag-name", value: "the-tag-value" }],
      }),
    };

    const result = await handleAnyRequest(event as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(PutItemCommand, {
      TableName: "MockUseCasesTable",
      Item: {
        orgId: { S: "the-org-id" },
        id: { S: "use-xsJQ5L5URaisxnyZmvpbuJ" },
        name: { S: "the-name" },
        description: { S: "the-description" },
        tags: {
          L: [
            {
              M: {
                name: { S: "the-tag-name" },
                value: { S: "the-tag-value" },
              },
            },
          ],
        },
      },
    });
    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        id: "use-xsJQ5L5URaisxnyZmvpbuJ",
        name: "the-name",
        description: "the-description",
        tags: [{ name: "the-tag-name", value: "the-tag-value" }],
      }),
    });
  });
});

describe("Test handleGetRequest", () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    ddbMock.reset();
  });

  it("should reject queries with no authorizer", async () => {
    await test_rejection_if_missing_authorizer(
      ddbMock,
      handleAnyRequest,
      "123",
      "GET",
    );
  });

  it("should reject queries with no orgId in claims", async () => {
    await test_rejection_if_missing_orgId(
      ddbMock,
      handleAnyRequest,
      "123",
      "GET",
    );
  });

  it("should handle not found use-cases", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      httpMethod: "GET",
      // @ts-expect-error
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      pathParameters: {
        id: "unknown-use-case-id",
      },
    };

    ddbMock.resolves({});
    const result = await handleAnyRequest(event as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(GetItemCommand, {
      TableName: "MockUseCasesTable",
      Key: {
        orgId: { S: "the-org-id" },
        id: { S: "unknown-use-case-id" },
      },
    });
    expect(result).toEqual({
      statusCode: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Not Found",
      }),
    });
  });

  it("should find existing use-case", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      httpMethod: "GET",
      // @ts-expect-error
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      pathParameters: {
        id: "existing-use-case-id",
      },
    };

    ddbMock
      .on(GetItemCommand, {
        Key: {
          orgId: { S: "the-org-id" },
          id: { S: "existing-use-case-id" },
        },
      })
      .resolves({
        Item: {
          orgId: { S: "the-org-id" },
          id: { S: "existing-use-case-id" },
          name: { S: "the-returned-name" },
          description: { S: "the-returned-description" },
          tags: {
            L: [
              {
                M: {
                  name: { S: "the-returned-tag-name" },
                  value: { S: "the-returned-tag-value" },
                },
              },
            ],
          },
        },
      });
    const result = await handleAnyRequest(event as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(GetItemCommand, {
      TableName: "MockUseCasesTable",
      Key: {
        orgId: { S: "the-org-id" },
        id: { S: "existing-use-case-id" },
      },
    });
    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        name: "the-returned-name",
        description: "the-returned-description",
        tags: [
          { name: "the-returned-tag-name", value: "the-returned-tag-value" },
        ],
        id: "existing-use-case-id",
      }),
    });
  });
});

describe("Test handlePutRequest", () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    ddbMock.reset();
  });

  it("should reject queries using other than JSON content type", async () => {
    await test_rejection_if_not_json_content_type(
      ddbMock,
      handleAnyRequest,
      "123",
      "PUT",
    );
  });

  it("should reject queries with no authorizer", async () => {
    await test_rejection_if_missing_authorizer(
      ddbMock,
      handleAnyRequest,
      "123",
      "PUT",
    );
  });

  it("should reject queries with no orgId in claims", async () => {
    await test_rejection_if_missing_orgId(
      ddbMock,
      handleAnyRequest,
      "123",
      "PUT",
    );
  });

  it("should handle missing use-case id", async () => {
    await test_rejection_if_missing_use_case_id(
      ddbMock,
      handleAnyRequest,
      "PUT",
    );
  });

  it("should handle mismatch between path parameter id and payload id", async () => {
    const eventWithoutId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      httpMethod: "PUT",
      // @ts-expect-error
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      pathParameters: {
        id: "path-parameter-use-case-id",
      },
      body: JSON.stringify({
        id: "json-body-use-case-id",
      }),
    };

    const result = await handleAnyRequest(
      eventWithoutId as APIGatewayProxyEvent,
    );

    expect(ddbMock.calls().length).toEqual(0);
    expect(result).toEqual({
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Id mismatch",
      }),
    });
  });

  it("should update use-case with user-provided data", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      httpMethod: "PUT",
      // @ts-expect-error
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      pathParameters: {
        id: "existing-use-case-id",
      },
      body: JSON.stringify({
        id: "existing-use-case-id",
        name: "the-updated-name",
        description: "the-updated-description",
        tags: [
          { name: "the-updated-tag-name", value: "the-updated-tag-value" },
        ],
      }),
    };

    const result = await handleAnyRequest(event as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(PutItemCommand, {
      ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      TableName: "MockUseCasesTable",
      Item: {
        orgId: { S: "the-org-id" },
        id: { S: "existing-use-case-id" },
        name: { S: "the-updated-name" },
        description: { S: "the-updated-description" },
        tags: {
          L: [
            {
              M: {
                name: { S: "the-updated-tag-name" },
                value: { S: "the-updated-tag-value" },
              },
            },
          ],
        },
      },
    });
    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        id: "existing-use-case-id",
        name: "the-updated-name",
        description: "the-updated-description",
        tags: [
          { name: "the-updated-tag-name", value: "the-updated-tag-value" },
        ],
      }),
    });
  });

  it("should not overwrite missing use-case", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      httpMethod: "PUT",
      // @ts-expect-error
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      pathParameters: {
        id: "existing-use-case-id",
      },
      body: JSON.stringify({
        id: "existing-use-case-id",
        name: "the-updated-name",
        description: "the-updated-description",
        tags: [
          { name: "the-updated-tag-name", value: "the-updated-tag-value" },
        ],
      }),
    };

    ddbMock.callsFake((input) => {
      throw new ConditionalCheckFailedException({
        message: "mocked rejection",
        $metadata: {},
      });
    });

    const result = await handleAnyRequest(event as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(PutItemCommand, {
      ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      TableName: "MockUseCasesTable",
      Item: {
        orgId: { S: "the-org-id" },
        id: { S: "existing-use-case-id" },
        name: { S: "the-updated-name" },
        description: { S: "the-updated-description" },
        tags: {
          L: [
            {
              M: {
                name: { S: "the-updated-tag-name" },
                value: { S: "the-updated-tag-value" },
              },
            },
          ],
        },
      },
    });
    expect(result).toEqual({
      statusCode: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Not Found",
      }),
    });
  });
});

describe("Test handleDeleteRequest", () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    ddbMock.reset();
  });

  it("should reject queries with no authorizer", async () => {
    await test_rejection_if_missing_authorizer(
      ddbMock,
      handleAnyRequest,
      "123",
      "DELETE",
    );
  });

  it("should reject queries with no orgId in claims", async () => {
    await test_rejection_if_missing_orgId(
      ddbMock,
      handleAnyRequest,
      "123",
      "DELETE",
    );
  });

  it("should handle missing use-case id", async () => {
    await test_rejection_if_missing_use_case_id(
      ddbMock,
      handleAnyRequest,
      "DELETE",
    );
  });

  it("should delete identified use-case", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      httpMethod: "DELETE",
      // @ts-expect-error
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      pathParameters: {
        id: "existing-use-case-id",
      },
    };

    const result = await handleAnyRequest(event as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(DeleteItemCommand, {
      ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      TableName: "MockUseCasesTable",
      Key: {
        orgId: { S: "the-org-id" },
        id: { S: "existing-use-case-id" },
      },
    });
    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({}),
    });
  });

  it("should fail to delete missing use-case", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      httpMethod: "DELETE",
      // @ts-expect-error
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      pathParameters: {
        id: "existing-use-case-id",
      },
    };

    ddbMock.callsFake((input) => {
      throw new ConditionalCheckFailedException({
        message: "mocked rejection",
        $metadata: {},
      });
    });

    const result = await handleAnyRequest(event as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(DeleteItemCommand, {
      ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      TableName: "MockUseCasesTable",
      Key: {
        orgId: { S: "the-org-id" },
        id: { S: "existing-use-case-id" },
      },
    });
    expect(result).toEqual({
      statusCode: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Not Found",
      }),
    });
  });
});

describe("Test handleGetAllRequest", () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    ddbMock.reset();
  });

  it("should reject queries with no authorizer", async () => {
    await test_rejection_if_missing_authorizer(
      ddbMock,
      handleAnyRequest,
      undefined,
      "GET",
    );
  });

  it("should reject queries with no orgId in claims", async () => {
    await test_rejection_if_missing_orgId(
      ddbMock,
      handleAnyRequest,
      undefined,
      "GET",
    );
  });

  it("should list all use-cases", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      httpMethod: "GET",
      // @ts-expect-error
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
    };

    ddbMock
      .on(ScanCommand, {
        TableName: "MockUseCasesTable",
        ExpressionAttributeNames: {
          "#O": "orgId",
          "#I": "id",
          "#N": "name",
          "#T": "tags",
        },
        ExpressionAttributeValues: {
          ":O": {
            S: "the-org-id",
          },
        },
        FilterExpression: "orgId = :O",
        ProjectionExpression: "#O, #I, #N, #T",
      })
      .resolves({
        Count: 3,
        Items: [
          {
            orgId: { S: "the-org-id" },
            id: { S: "use-case-id-1" },
            name: { S: "name-1" },
            description: { S: "description-1" },
            tags: {
              L: [
                {
                  M: {
                    name: { S: "tag-1-name" },
                    value: { S: "tag-1-value-1" },
                  },
                },
                {
                  M: {
                    name: { S: "tag-2-name" },
                    value: { S: "tag-2-value-1" },
                  },
                },
              ],
            },
          },
          {
            orgId: { S: "the-org-id" },
            id: { S: "use-case-id-2" },
            name: { S: "name-2" },
            description: { S: "description-2" },
            tags: {
              L: [
                {
                  M: {
                    name: { S: "tag-1-name" },
                    value: { S: "tag-1-value-2" },
                  },
                },
              ],
            },
          },
          {
            orgId: { S: "the-org-id" },
            id: { S: "use-case-id-3" },
            name: { S: "name-3" },
            description: { S: "description-3" },
            tags: {
              L: [
                {
                  M: {
                    name: { S: "tag-1-name" },
                    value: { S: "tag-1-value-3" },
                  },
                },
                {
                  M: {
                    name: { S: "tag-2-name" },
                    value: { S: "tag-2-value-3" },
                  },
                },
                {
                  M: {
                    name: { S: "tag-3-name" },
                    value: { S: "tag-3-value-3" },
                  },
                },
              ],
            },
          },
        ],
      });
    const result = await handleAnyRequest(event as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(ScanCommand, {
      TableName: "MockUseCasesTable",
      ExpressionAttributeNames: {
        "#O": "orgId",
        "#I": "id",
        "#N": "name",
        "#T": "tags",
      },
      ExpressionAttributeValues: {
        ":O": {
          S: "the-org-id",
        },
      },
      FilterExpression: "orgId = :O",
      ProjectionExpression: "#O, #I, #N, #T",
    });
    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify([
        {
          name: "name-1",
          description: "description-1",
          tags: [
            { name: "tag-1-name", value: "tag-1-value-1" },
            { name: "tag-2-name", value: "tag-2-value-1" },
          ],
          id: "use-case-id-1",
        },
        {
          name: "name-2",
          description: "description-2",
          tags: [{ name: "tag-1-name", value: "tag-1-value-2" }],
          id: "use-case-id-2",
        },
        {
          name: "name-3",
          description: "description-3",
          tags: [
            { name: "tag-1-name", value: "tag-1-value-3" },
            { name: "tag-2-name", value: "tag-2-value-3" },
            { name: "tag-3-name", value: "tag-3-value-3" },
          ],
          id: "use-case-id-3",
        },
      ]),
    });
  });
});

async function test_rejection_if_missing_use_case_id(
  ddbMock: any,
  requestHandler: (e: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>,
  httpMethod: string,
) {
  const eventWithoutId: Partial<APIGatewayProxyEvent> = {
    headers: {
      "content-type": "application/json",
    },
    // @ts-expect-error
    requestContext: {
      authorizer: {
        claims: {
          "custom:orgId": "the-org-id",
        },
      },
    },
    httpMethod,
  };

  const result = await requestHandler(eventWithoutId as APIGatewayProxyEvent);

  expect(ddbMock.calls().length).toEqual(0);
  expect(result).toEqual({
    statusCode: 400,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      message: "Missing id",
    }),
  });
}
