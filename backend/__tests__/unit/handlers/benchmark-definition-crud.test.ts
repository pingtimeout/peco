import {
  handlePostRequest,
  handlePutRequest,
  handleGetRequest,
  handleGetAllRequest,
  handleDeleteRequest,
} from "../../../src/handlers/benchmark-definition-crud";
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

jest.mock("../../../src/time-source", () => {
  const originalModule = jest.requireActual("../../../src/time-source");
  return {
    __esModule: true,
    ...originalModule,
    currentTimestamp: jest.fn(() => 1706201101633), // 2024-01-25T16:45:01.633Z
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

  it("should override user-provided benchmark-definition id and last updated date", async () => {
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
        useCaseId: "the-use-case-id",
        environmentId: "the-environment-id",
        productId: "the-product-id",
        jenkinsJobUrl: "the-jenkins-job-url",
        lastUpdatedOn: 123456,
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
        useCaseId: { S: "the-use-case-id" },
        environmentId: { S: "the-environment-id" },
        productId: { S: "the-product-id" },
        jenkinsJobUrl: { S: "the-jenkins-job-url" },
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
        lastUpdatedOn: { N: "1706201101633" },
      },
    });
    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        id: "00000000-1111-2222-3333-444444444444",
        useCaseId: "the-use-case-id",
        environmentId: "the-environment-id",
        productId: "the-product-id",
        jenkinsJobUrl: "the-jenkins-job-url",
        tags: [{ name: "the-tag-name", value: "the-tag-value" }],
        lastUpdatedOn: 1706201101633,
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

  it("should handle missing benchmark-definition id", async () => {
    test_rejection_if_missing_benchmark_definition_id(
      ddbMock,
      handleGetRequest
    );
  });

  it("should handle not found benchmark-definitions", async () => {
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
        id: "unknown-benchmark-definition-id",
      },
    };

    ddbMock.resolves({});
    const result = await handleGetRequest(eventWithId as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(GetItemCommand, {
      TableName: undefined,
      Key: {
        orgId: { S: "the-org-id" },
        id: { S: "unknown-benchmark-definition-id" },
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

  it("should find existing benchmark-definition", async () => {
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
        id: "existing-benchmark-definition-id",
      },
    };

    ddbMock
      .on(GetItemCommand, {
        Key: {
          orgId: { S: "the-org-id" },
          id: { S: "existing-benchmark-definition-id" },
        },
      })
      .resolves({
        Item: {
          orgId: { S: "the-org-id" },
          id: { S: "existing-benchmark-definition-id" },
          useCaseId: { S: "the-use-case-id" },
          environmentId: { S: "the-environment-id" },
          productId: { S: "the-product-id" },
          jenkinsJobUrl: { S: "the-jenkins-job-url" },
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
          lastUpdatedOn: { N: "1706201101633" },
        },
      });
    const result = await handleGetRequest(eventWithId as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(GetItemCommand, {
      TableName: undefined,
      Key: {
        orgId: { S: "the-org-id" },
        id: { S: "existing-benchmark-definition-id" },
      },
    });
    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        id: "existing-benchmark-definition-id",
        useCaseId: "the-use-case-id",
        environmentId: "the-environment-id",
        productId: "the-product-id",
        jenkinsJobUrl: "the-jenkins-job-url",
        tags: [{ name: "the-tag-name", value: "the-tag-value" }],
        lastUpdatedOn: 1706201101633,
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

  it("should handle missing benchmark-definition id", async () => {
    test_rejection_if_missing_benchmark_definition_id(
      ddbMock,
      handlePutRequest
    );
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
        id: "path-parameter-benchmark-definition-id",
      },
      body: JSON.stringify({
        id: "json-body-benchmark-definition-id",
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

  it("should update benchmark-definition with user-provided data", async () => {
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
        id: "existing-benchmark-definition-id",
      },
      body: JSON.stringify({
        id: "existing-benchmark-definition-id",
        useCaseId: "the-updated-use-case-id",
        environmentId: "the-updated-environment-id",
        productId: "the-updated-product-id",
        jenkinsJobUrl: "the-jenkins-job-url",
        lastUpdatedOn: 123456,
        tags: [{ name: "the-tag-name", value: "the-tag-value" }],
      }),
    };

    const result = await handlePutRequest(eventWithId as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(PutItemCommand, {
      ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      TableName: undefined,
      Item: {
        orgId: { S: "the-org-id" },
        id: { S: "existing-benchmark-definition-id" },
        useCaseId: { S: "the-updated-use-case-id" },
        environmentId: { S: "the-updated-environment-id" },
        productId: { S: "the-updated-product-id" },
        jenkinsJobUrl: { S: "the-jenkins-job-url" },
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
        lastUpdatedOn: { N: "1706201101633" },
      },
    });
    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        id: "existing-benchmark-definition-id",
        useCaseId: "the-updated-use-case-id",
        environmentId: "the-updated-environment-id",
        productId: "the-updated-product-id",
        jenkinsJobUrl: "the-jenkins-job-url",
        tags: [{ name: "the-tag-name", value: "the-tag-value" }],
        lastUpdatedOn: 1706201101633,
      }),
    });
  });

  it("should not overwrite missing benchmark-definition", async () => {
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
        id: "missing-benchmark-definition-id",
      },
      body: JSON.stringify({
        id: "missing-benchmark-definition-id",
        useCaseId: "the-updated-use-case-id",
        environmentId: "the-updated-environment-id",
        productId: "the-updated-product-id",
        jenkinsJobUrl: "the-jenkins-job-url",
        tags: [{ name: "the-tag-name", value: "the-tag-value" }],
      }),
    };

    ddbMock
      .callsFake((input) => {
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
        id: { S: "missing-benchmark-definition-id" },
        useCaseId: { S: "the-updated-use-case-id" },
        environmentId: { S: "the-updated-environment-id" },
        productId: { S: "the-updated-product-id" },
        jenkinsJobUrl: { S: "the-jenkins-job-url" },
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
        lastUpdatedOn: { N: "1706201101633" },
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

  it("should handle missing benchmark-definition id", async () => {
    test_rejection_if_missing_benchmark_definition_id(
      ddbMock,
      handleDeleteRequest
    );
  });

  it("should delete identified benchmark-definition", async () => {
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
        id: "existing-benchmark-definition-id",
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
        id: { S: "existing-benchmark-definition-id" },
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

  it("should fail to delete missing benchmark-definition", async () => {
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
        id: "existing-benchmark-definition-id",
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
        id: { S: "existing-benchmark-definition-id" },
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

  it("should list all benchmark-definitions", async () => {
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
          "#UI": "useCaseId",
          "#EI": "environmentId",
          "#PI": "productId",
          "#J": "jenkinsJobUrl",
          "#T": "tags",
          "#L": "lastUpdatedOn",
        },
        ExpressionAttributeValues: {
          ":O": {
            S: "the-org-id",
          },
        },
        FilterExpression: "orgId = :O",
        ProjectionExpression: "#O, #I, #UI, #EI, #PI, #J, #T, #L",
      })
      .resolves({
        Count: 3,
        Items: [
          {
            orgId: { S: "the-org-id" },
            id: { S: "benchmark-definition-id-1" },
            useCaseId: { S: "the-use-case-id-1" },
            environmentId: { S: "the-environment-id-1" },
            productId: { S: "the-product-id-1" },
            jenkinsJobUrl: { S: "the-jenkins-job-url-1" },
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
            lastUpdatedOn: { N: "1706201101633" },
          },
          {
            orgId: { S: "the-org-id" },
            id: { S: "benchmark-definition-id-2" },
            useCaseId: { S: "the-use-case-id-2" },
            environmentId: { S: "the-environment-id-2" },
            productId: { S: "the-product-id-2" },
            jenkinsJobUrl: { S: "the-jenkins-job-url-2" },
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
            lastUpdatedOn: { N: "1706201101632" },
          },
          {
            orgId: { S: "the-org-id" },
            id: { S: "benchmark-definition-id-3" },
            useCaseId: { S: "the-use-case-id-3" },
            environmentId: { S: "the-environment-id-3" },
            productId: { S: "the-product-id-3" },
            jenkinsJobUrl: { S: "the-jenkins-job-url-3" },
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
            lastUpdatedOn: { N: "1706201101631" },
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
        "#UI": "useCaseId",
        "#EI": "environmentId",
        "#PI": "productId",
        "#J": "jenkinsJobUrl",
        "#T": "tags",
        "#L": "lastUpdatedOn",
      },
      ExpressionAttributeValues: {
        ":O": {
          S: "the-org-id",
        },
      },
      FilterExpression: "orgId = :O",
      ProjectionExpression: "#O, #I, #UI, #EI, #PI, #J, #T, #L",
    });
    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify([
        {
          id: "benchmark-definition-id-1",
          useCaseId: "the-use-case-id-1",
          environmentId: "the-environment-id-1",
          productId: "the-product-id-1",
          jenkinsJobUrl: "the-jenkins-job-url-1",
          tags: [{ name: "the-tag-name", value: "the-tag-value" }],
          lastUpdatedOn: 1706201101633,
        },
        {
          id: "benchmark-definition-id-2",
          useCaseId: "the-use-case-id-2",
          environmentId: "the-environment-id-2",
          productId: "the-product-id-2",
          jenkinsJobUrl: "the-jenkins-job-url-2",
          tags: [{ name: "the-tag-name", value: "the-tag-value" }],
          lastUpdatedOn: 1706201101632,
        },
        {
          id: "benchmark-definition-id-3",
          useCaseId: "the-use-case-id-3",
          environmentId: "the-environment-id-3",
          productId: "the-product-id-3",
          jenkinsJobUrl: "the-jenkins-job-url-3",
          tags: [{ name: "the-tag-name", value: "the-tag-value" }],
          lastUpdatedOn: 1706201101631,
        },
      ]),
    });
  });
});

async function test_rejection_if_missing_benchmark_definition_id(
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