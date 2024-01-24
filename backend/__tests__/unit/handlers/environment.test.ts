import {
  handlePostRequest,
  handlePutRequest,
  handleGetRequest,
  handleGetAllRequest,
  handleDeleteRequest,
} from "../../../src/handlers/environment-crud";

import {
  ScanCommand,
  PutItemCommand,
  DeleteItemCommand,
  ConditionalCheckFailedException,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { APIGatewayProxyEvent } from "aws-lambda";

jest.mock("../../../src/uuid-generator", () => {
  const originalModule = jest.requireActual(
    "../../../src/uuid-generator"
  );
  return {
    __esModule: true,
    ...originalModule,
    generateUuid: jest.fn(() => "00000000-1111-2222-3333-444444444444"),
  };
});

describe("Test handlePostRequest", () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    ddbMock.reset();
  });

  it("should reject queries using other than JSON content type", async () => {
    const apiGatewayEvent: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
    };
    const result = await handlePostRequest(
      apiGatewayEvent as APIGatewayProxyEvent
    );
    expect(ddbMock.calls().length).toEqual(0);
    expect(result).toEqual({
      statusCode: 415,
      body: JSON.stringify({
        message: "Unsupported Media Type",
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  });

  it("should reject queries with no authorizer", async () => {
    const eventWithoutAuthorizer: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {},
    };
    const resultWithoutAuthorizer = await handlePostRequest(
      eventWithoutAuthorizer as APIGatewayProxyEvent
    );
    expect(ddbMock.calls().length).toEqual(0);
    expect(resultWithoutAuthorizer).toEqual({
      statusCode: 401,
      body: JSON.stringify({
        message: "Missing orgId",
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  });

  it("should reject queries with no orgId in claims", async () => {
    const eventWithoutOrgId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {
        authorizer: {
          claims: {},
        },
      },
    };
    const resultWithoutOrgId = await handlePostRequest(
      eventWithoutOrgId as APIGatewayProxyEvent
    );
    expect(ddbMock.calls().length).toEqual(0);
    expect(resultWithoutOrgId).toEqual({
      statusCode: 401,
      body: JSON.stringify({
        message: "Missing orgId",
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  });

  it("should override user-provided environment id", async () => {
    const eventWithId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
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

    const result = await handlePostRequest(eventWithId as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(PutItemCommand, {
      TableName: undefined,
      Item: {
        orgId: { S: "the-org-id" },
        id: { S: "00000000-1111-2222-3333-444444444444" },
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
        id: "00000000-1111-2222-3333-444444444444",
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
    const eventWithoutAuthorizer: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {},
    };
    const resultWithoutAuthorizer = await handleGetRequest(
      eventWithoutAuthorizer as APIGatewayProxyEvent
    );
    expect(ddbMock.calls().length).toEqual(0);
    expect(resultWithoutAuthorizer).toEqual({
      statusCode: 401,
      body: JSON.stringify({
        message: "Missing orgId",
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  });

  it("should reject queries with no orgId in claims", async () => {
    const eventWithoutOrgId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {
        authorizer: {
          claims: {},
        },
      },
    };
    const resultWithoutOrgId = await handleGetRequest(
      eventWithoutOrgId as APIGatewayProxyEvent
    );
    expect(ddbMock.calls().length).toEqual(0);
    expect(resultWithoutOrgId).toEqual({
      statusCode: 401,
      body: JSON.stringify({
        message: "Missing orgId",
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  });

  it("should handle missing environment id", async () => {
    const eventWithoutId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
    };

    const result = await handleGetRequest(
      eventWithoutId as APIGatewayProxyEvent
    );

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
  });

  it("should handle not found environments", async () => {
    const eventWithId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      pathParameters: {
        id: "unknown-environment-id",
      },
    };

    ddbMock.resolves({});
    const result = await handleGetRequest(eventWithId as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(GetItemCommand, {
      TableName: undefined,
      Key: {
        orgId: { S: "the-org-id" },
        id: { S: "unknown-environment-id" },
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

  it("should find existing environments", async () => {
    const eventWithId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      pathParameters: {
        id: "existing-environment-id",
      },
    };

    ddbMock
      .on(GetItemCommand, {
        Key: {
          orgId: { S: "the-org-id" },
          id: { S: "existing-environment-id" },
        },
      })
      .resolves({
        Item: {
          orgId: { S: "the-org-id" },
          id: { S: "existing-environment-id" },
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
    const result = await handleGetRequest(eventWithId as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(GetItemCommand, {
      TableName: undefined,
      Key: {
        orgId: { S: "the-org-id" },
        id: { S: "existing-environment-id" },
      },
    });
    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        id: "existing-environment-id",
        name: "the-returned-name",
        description: "the-returned-description",
        tags: [
          { name: "the-returned-tag-name", value: "the-returned-tag-value" },
        ],
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
    const apiGatewayEvent: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
    };
    const result = await handlePutRequest(
      apiGatewayEvent as APIGatewayProxyEvent
    );
    expect(ddbMock.calls().length).toEqual(0);
    expect(result).toEqual({
      statusCode: 415,
      body: JSON.stringify({
        message: "Unsupported Media Type",
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  });

  it("should reject queries with no authorizer", async () => {
    const eventWithoutAuthorizer: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {},
    };
    const resultWithoutAuthorizer = await handlePutRequest(
      eventWithoutAuthorizer as APIGatewayProxyEvent
    );
    expect(ddbMock.calls().length).toEqual(0);
    expect(resultWithoutAuthorizer).toEqual({
      statusCode: 401,
      body: JSON.stringify({
        message: "Missing orgId",
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  });

  it("should reject queries with no orgId in claims", async () => {
    const eventWithoutOrgId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {
        authorizer: {
          claims: {},
        },
      },
    };
    const resultWithoutOrgId = await handlePutRequest(
      eventWithoutOrgId as APIGatewayProxyEvent
    );
    expect(ddbMock.calls().length).toEqual(0);
    expect(resultWithoutOrgId).toEqual({
      statusCode: 401,
      body: JSON.stringify({
        message: "Missing orgId",
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  });

  it("should handle missing environment id", async () => {
    const eventWithoutId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
    };

    const result = await handlePutRequest(
      eventWithoutId as APIGatewayProxyEvent
    );

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
  });

  it("should handle mismatch between path parameter id and payload id", async () => {
    const eventWithoutId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      pathParameters: {
        id: "path-parameter-environment-id",
      },
      body: JSON.stringify({
        id: "json-body-environment-id",
      }),
    };

    const result = await handlePutRequest(
      eventWithoutId as APIGatewayProxyEvent
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

  it("should update environment with user-provided data", async () => {
    const eventWithId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      pathParameters: {
        id: "existing-environment-id",
      },
      body: JSON.stringify({
        id: "existing-environment-id",
        name: "the-updated-name",
        description: "the-updated-description",
        tags: [
          { name: "the-updated-tag-name", value: "the-updated-tag-value" },
        ],
      }),
    };

    const result = await handlePutRequest(eventWithId as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(PutItemCommand, {
      ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      TableName: undefined,
      Item: {
        orgId: { S: "the-org-id" },
        id: { S: "existing-environment-id" },
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
        id: "existing-environment-id",
        name: "the-updated-name",
        description: "the-updated-description",
        tags: [
          { name: "the-updated-tag-name", value: "the-updated-tag-value" },
        ],
      }),
    });
  });

  it("should not overwrite missing environment", async () => {
    const eventWithId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      pathParameters: {
        id: "existing-environment-id",
      },
      body: JSON.stringify({
        id: "existing-environment-id",
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

    const result = await handlePutRequest(eventWithId as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(PutItemCommand, {
      ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      TableName: undefined,
      Item: {
        orgId: { S: "the-org-id" },
        id: { S: "existing-environment-id" },
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
    const eventWithoutAuthorizer: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {},
    };
    const resultWithoutAuthorizer = await handleDeleteRequest(
      eventWithoutAuthorizer as APIGatewayProxyEvent
    );
    expect(ddbMock.calls().length).toEqual(0);
    expect(resultWithoutAuthorizer).toEqual({
      statusCode: 401,
      body: JSON.stringify({
        message: "Missing orgId",
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  });

  it("should reject queries with no orgId in claims", async () => {
    const eventWithoutOrgId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {
        authorizer: {
          claims: {},
        },
      },
    };
    const resultWithoutOrgId = await handleDeleteRequest(
      eventWithoutOrgId as APIGatewayProxyEvent
    );
    expect(ddbMock.calls().length).toEqual(0);
    expect(resultWithoutOrgId).toEqual({
      statusCode: 401,
      body: JSON.stringify({
        message: "Missing orgId",
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  });

  it("should handle missing environment id", async () => {
    const eventWithoutId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
    };

    const result = await handleDeleteRequest(
      eventWithoutId as APIGatewayProxyEvent
    );

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
  });

  it("should delete identified environment", async () => {
    const eventWithId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      pathParameters: {
        id: "existing-environment-id",
      },
    };

    const result = await handleDeleteRequest(
      eventWithId as APIGatewayProxyEvent
    );

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(DeleteItemCommand, {
      ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      TableName: undefined,
      Key: {
        orgId: { S: "the-org-id" },
        id: { S: "existing-environment-id" },
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

  it("should fail to delete missing environment", async () => {
    const eventWithId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      pathParameters: {
        id: "existing-environment-id",
      },
    };

    ddbMock.callsFake((input) => {
      throw new ConditionalCheckFailedException({
        message: "mocked rejection",
        $metadata: {},
      });
    });

    const result = await handleDeleteRequest(
      eventWithId as APIGatewayProxyEvent
    );

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(DeleteItemCommand, {
      ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      TableName: undefined,
      Key: {
        orgId: { S: "the-org-id" },
        id: { S: "existing-environment-id" },
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
    const eventWithoutAuthorizer: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {},
    };
    const resultWithoutAuthorizer = await handleGetAllRequest(
      eventWithoutAuthorizer as APIGatewayProxyEvent
    );
    expect(ddbMock.calls().length).toEqual(0);
    expect(resultWithoutAuthorizer).toEqual({
      statusCode: 401,
      body: JSON.stringify({
        message: "Missing orgId",
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  });

  it("should reject queries with no orgId in claims", async () => {
    const eventWithoutOrgId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
      requestContext: {
        authorizer: {
          claims: {},
        },
      },
    };
    const resultWithoutOrgId = await handleGetAllRequest(
      eventWithoutOrgId as APIGatewayProxyEvent
    );
    expect(ddbMock.calls().length).toEqual(0);
    expect(resultWithoutOrgId).toEqual({
      statusCode: 401,
      body: JSON.stringify({
        message: "Missing orgId",
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  });

  it("should list all environments", async () => {
    const eventWithId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      // @ts-ignore
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
        TableName: undefined,
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
            id: { S: "environment-id-1" },
            name: { S: "name-1" },
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
            id: { S: "environment-id-2" },
            name: { S: "name-2" },
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
            id: { S: "environment-id-3" },
            name: { S: "name-3" },
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
    const result = await handleGetAllRequest(
      eventWithId as APIGatewayProxyEvent
    );

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(ScanCommand, {
      TableName: undefined,
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
          id: "environment-id-1",
          name: "name-1",
          tags: [
            { name: "tag-1-name", value: "tag-1-value-1" },
            { name: "tag-2-name", value: "tag-2-value-1" },
          ],
        },
        {
          id: "environment-id-2",
          name: "name-2",
          tags: [{ name: "tag-1-name", value: "tag-1-value-2" }],
        },
        {
          id: "environment-id-3",
          name: "name-3",
          tags: [
            { name: "tag-1-name", value: "tag-1-value-3" },
            { name: "tag-2-name", value: "tag-2-value-3" },
            { name: "tag-3-name", value: "tag-3-value-3" },
          ],
        },
      ]),
    });
  });
});
