import {
  handlePostRequest,
  handlePutRequest,
  handleGetRequest,
  handleGetAllRequest,
  handleDeleteRequest,
} from "../../../src/handlers/metric-definition-crud";
import {
  test_rejection_if_not_json_content_type,
  test_rejection_if_missing_orgId,
  test_rejection_if_missing_authorizer,
} from "../handler-util";
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
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

jest.mock("../../../src/uuid-generator", () => {
  const originalModule = jest.requireActual("../../../src/uuid-generator");
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
    test_rejection_if_not_json_content_type(ddbMock, handlePostRequest);
  });

  it("should reject queries with no authorizer", async () => {
    test_rejection_if_missing_authorizer(ddbMock, handlePostRequest);
  });

  it("should reject queries with no orgId in claims", async () => {
    test_rejection_if_missing_orgId(ddbMock, handlePostRequest);
  });

  it("should override user-provided metric-definition id", async () => {
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
        unit: "percent",
        regressionDirection: "up",
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
        unit: { S: "percent" },
        regressionDirection: { S: "up" },
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
        unit: "percent",
        regressionDirection: "up",
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
    test_rejection_if_missing_authorizer(ddbMock, handleGetRequest);
  });

  it("should reject queries with no orgId in claims", async () => {
    test_rejection_if_missing_orgId(ddbMock, handleGetRequest);
  });

  it("should handle missing metric-definition id", async () => {
    test_rejection_if_missing_metric_definition_id(ddbMock, handleGetRequest);
  });

  it("should handle not found metric-definitions", async () => {
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
        id: "unknown-metric-definition-id",
      },
    };

    ddbMock.resolves({});
    const result = await handleGetRequest(eventWithId as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(GetItemCommand, {
      TableName: undefined,
      Key: {
        orgId: { S: "the-org-id" },
        id: { S: "unknown-metric-definition-id" },
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

  it("should find existing metric-definition", async () => {
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
        id: "existing-metric-definition-id",
      },
    };

    ddbMock
      .on(GetItemCommand, {
        Key: {
          orgId: { S: "the-org-id" },
          id: { S: "existing-metric-definition-id" },
        },
      })
      .resolves({
        Item: {
          orgId: { S: "the-org-id" },
          id: { S: "existing-metric-definition-id" },
          name: { S: "the-returned-name" },
          description: { S: "the-returned-description" },
          unit: { S: "bytes/s" },
          regressionDirection: { S: "down" },
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
        id: { S: "existing-metric-definition-id" },
      },
    });
    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        id: "existing-metric-definition-id",
        name: "the-returned-name",
        description: "the-returned-description",
        unit: "bytes/s",
        regressionDirection: "down",
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
    test_rejection_if_not_json_content_type(ddbMock, handlePutRequest);
  });

  it("should reject queries with no authorizer", async () => {
    test_rejection_if_missing_authorizer(ddbMock, handlePutRequest);
  });

  it("should reject queries with no orgId in claims", async () => {
    test_rejection_if_missing_orgId(ddbMock, handlePutRequest);
  });

  it("should handle missing metric-definition id", async () => {
    test_rejection_if_missing_metric_definition_id(ddbMock, handlePutRequest);
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
        id: "path-parameter-metric-definition-id",
      },
      body: JSON.stringify({
        id: "json-body-metric-definition-id",
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

  it("should update metric-definition with user-provided data", async () => {
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
        id: "existing-metric-definition-id",
      },
      body: JSON.stringify({
        id: "existing-metric-definition-id",
        name: "the-updated-name",
        description: "the-updated-description",
        unit: "none",
        regressionDirection: "up",
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
        id: { S: "existing-metric-definition-id" },
        name: { S: "the-updated-name" },
        description: { S: "the-updated-description" },
        unit: { S: "none" },
        regressionDirection: { S: "up" },
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
        id: "existing-metric-definition-id",
        name: "the-updated-name",
        description: "the-updated-description",
        unit: "none",
        regressionDirection: "up",
        tags: [
          { name: "the-updated-tag-name", value: "the-updated-tag-value" },
        ],
      }),
    });
  });

  it("should not overwrite missing metric-definition", async () => {
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
        id: "existing-metric-definition-id",
      },
      body: JSON.stringify({
        id: "existing-metric-definition-id",
        name: "the-updated-name",
        description: "the-updated-description",
        unit: "percent",
        regressionDirection: "down",
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
        id: { S: "existing-metric-definition-id" },
        name: { S: "the-updated-name" },
        description: { S: "the-updated-description" },
        unit: { S: "percent" },
        regressionDirection: { S: "down" },
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
    test_rejection_if_missing_authorizer(ddbMock, handleDeleteRequest);
  });

  it("should reject queries with no orgId in claims", async () => {
    test_rejection_if_missing_orgId(ddbMock, handleDeleteRequest);
  });

  it("should handle missing metric-definition id", async () => {
    test_rejection_if_missing_metric_definition_id(
      ddbMock,
      handleDeleteRequest
    );
  });

  it("should delete identified metric-definition", async () => {
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
        id: "existing-metric-definition-id",
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
        id: { S: "existing-metric-definition-id" },
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

  it("should fail to delete missing metric-definition", async () => {
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
        id: "existing-metric-definition-id",
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
        id: { S: "existing-metric-definition-id" },
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
    test_rejection_if_missing_authorizer(ddbMock, handleGetAllRequest);
  });

  it("should reject queries with no orgId in claims", async () => {
    test_rejection_if_missing_orgId(ddbMock, handleGetAllRequest);
  });

  it("should list all metric-definitions", async () => {
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
          "#U": "unit",
          "#R": "regressionDirection",
          "#T": "tags",
        },
        ExpressionAttributeValues: {
          ":O": {
            S: "the-org-id",
          },
        },
        FilterExpression: "orgId = :O",
        ProjectionExpression: "#O, #I, #N, #U, #R, #T",
      })
      .resolves({
        Count: 3,
        Items: [
          {
            orgId: { S: "the-org-id" },
            id: { S: "metric-definition-id-1" },
            name: { S: "name-1" },
            unit: { S: "bytes/s" },
            regressionDirection: { S: "down" },
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
            id: { S: "metric-definition-id-2" },
            name: { S: "name-2" },
            unit: { S: "bits/s" },
            regressionDirection: { S: "up" },
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
            id: { S: "metric-definition-id-3" },
            name: { S: "name-3" },
            unit: { S: "percent" },
            regressionDirection: { S: "up" },
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
        "#U": "unit",
        "#R": "regressionDirection",
        "#T": "tags",
      },
      ExpressionAttributeValues: {
        ":O": {
          S: "the-org-id",
        },
      },
      FilterExpression: "orgId = :O",
      ProjectionExpression: "#O, #I, #N, #U, #R, #T",
    });
    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify([
        {
          id: "metric-definition-id-1",
          name: "name-1",
          unit: "bytes/s",
          regressionDirection: "down",
          tags: [
            { name: "tag-1-name", value: "tag-1-value-1" },
            { name: "tag-2-name", value: "tag-2-value-1" },
          ],
        },
        {
          id: "metric-definition-id-2",
          name: "name-2",
          unit: "bits/s",
          regressionDirection: "up",
          tags: [{ name: "tag-1-name", value: "tag-1-value-2" }],
        },
        {
          id: "metric-definition-id-3",
          name: "name-3",
          unit: "percent",
          regressionDirection: "up",
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

async function test_rejection_if_missing_metric_definition_id(
  ddbMock: any,
  requestHandler: (e: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>
) {
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
