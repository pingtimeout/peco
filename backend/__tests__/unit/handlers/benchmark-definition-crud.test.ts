import "aws-sdk-client-mock-jest";

import {
  BatchGetItemCommand,
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

import { handleAnyRequest } from "../../../src/handlers/benchmark-definition-crud";
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
    environmentsTableName: new lazy.Lazy(() => "MockEnvironmentsTable"),
    productsTableName: new lazy.Lazy(() => "MockProductsTable"),
    benchmarkDefinitionsTableName: new lazy.Lazy(
      () => "MockBenchmarkDefinitionsTable",
    ),
  };
});

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

  it("should override user-provided benchmark-definition id and last updated date", async () => {
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
        useCaseId: "the-use-case-id",
        environmentId: "the-environment-id",
        productId: "the-product-id",
        jenkinsJobUrl: "the-jenkins-job-url",
        lastUploadedTimestamp: 123456,
        tags: [{ name: "the-tag-name", value: "the-tag-value" }],
      }),
    };

    ddbMock.resolves({
      Responses: {
        MockUseCasesTable: [{}],
        MockEnvironmentsTable: [{}],
        MockProductsTable: [{}],
      },
    });
    const result = await handleAnyRequest(event as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(2);
    expect(ddbMock).toHaveReceivedCommandWith(PutItemCommand, {
      TableName: "MockBenchmarkDefinitionsTable",
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
        lastUploadedTimestamp: { N: "1706201101633" },
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
        lastUploadedTimestamp: 1706201101633,
      }),
    });
  });

  it("should verify existence of linked use-case, environment and product", async () => {
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
        useCaseId: "the-use-case-id",
        environmentId: "the-environment-id",
        productId: "the-product-id",
        tags: [{ name: "the-tag-name", value: "the-tag-value" }],
      }),
    };

    ddbMock
      .on(BatchGetItemCommand, {
        RequestItems: {
          MockUseCasesTable: {
            Keys: [
              {
                orgId: { S: "the-org-id" },
                id: { S: "the-use-case-id" },
              },
            ],
          },
          MockEnvironmentsTable: {
            Keys: [
              {
                orgId: { S: "the-org-id" },
                id: { S: "the-environment-id" },
              },
            ],
          },
          MockProductsTable: {
            Keys: [
              {
                orgId: { S: "the-org-id" },
                id: { S: "the-product-id" },
              },
            ],
          },
        },
      })
      .resolves({
        Responses: {
          MockUseCasesTable: [{}],
          MockEnvironmentsTable: [{}],
          MockProductsTable: [{}],
        },
      });
    const result = await handleAnyRequest(event as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(2);
    expect(ddbMock).toHaveReceivedCommandWith(BatchGetItemCommand, {
      RequestItems: {
        MockUseCasesTable: {
          Keys: [
            {
              orgId: { S: "the-org-id" },
              id: { S: "the-use-case-id" },
            },
          ],
        },
        MockEnvironmentsTable: {
          Keys: [
            {
              orgId: { S: "the-org-id" },
              id: { S: "the-environment-id" },
            },
          ],
        },
        MockProductsTable: {
          Keys: [
            {
              orgId: { S: "the-org-id" },
              id: { S: "the-product-id" },
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
        useCaseId: "the-use-case-id",
        environmentId: "the-environment-id",
        productId: "the-product-id",
        tags: [{ name: "the-tag-name", value: "the-tag-value" }],
        lastUploadedTimestamp: 1706201101633,
      }),
    });
  });

  it("should reject when referenced use-case is missing", async () => {
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
        useCaseId: "the-use-case-id",
        environmentId: "the-environment-id",
        productId: "the-product-id",
        tags: [{ name: "the-tag-name", value: "the-tag-value" }],
      }),
    };

    ddbMock
      .on(BatchGetItemCommand, {
        RequestItems: {
          MockUseCasesTable: {
            Keys: [
              {
                orgId: { S: "the-org-id" },
                id: { S: "the-use-case-id" },
              },
            ],
          },
          MockEnvironmentsTable: {
            Keys: [
              {
                orgId: { S: "the-org-id" },
                id: { S: "the-environment-id" },
              },
            ],
          },
          MockProductsTable: {
            Keys: [
              {
                orgId: { S: "the-org-id" },
                id: { S: "the-product-id" },
              },
            ],
          },
        },
      })
      .resolves({
        Responses: {
          MockUseCasesTable: [],
          MockEnvironmentsTable: [{}],
          MockProductsTable: [{}],
        },
      });
    const result = await handleAnyRequest(event as APIGatewayProxyEvent);

    expect(result).toEqual({
      statusCode: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Linked entity not found",
      }),
    });
  });

  it("should reject when referenced environment is missing", async () => {
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
        useCaseId: "the-use-case-id",
        environmentId: "the-environment-id",
        productId: "the-product-id",
        tags: [{ name: "the-tag-name", value: "the-tag-value" }],
      }),
    };

    ddbMock
      .on(BatchGetItemCommand, {
        RequestItems: {
          MockUseCasesTable: {
            Keys: [
              {
                orgId: { S: "the-org-id" },
                id: { S: "the-use-case-id" },
              },
            ],
          },
          MockEnvironmentsTable: {
            Keys: [
              {
                orgId: { S: "the-org-id" },
                id: { S: "the-environment-id" },
              },
            ],
          },
          MockProductsTable: {
            Keys: [
              {
                orgId: { S: "the-org-id" },
                id: { S: "the-product-id" },
              },
            ],
          },
        },
      })
      .resolves({
        Responses: {
          MockUseCasesTable: [{}],
          MockEnvironmentsTable: [],
          MockProductsTable: [{}],
        },
      });
    const result = await handleAnyRequest(event as APIGatewayProxyEvent);

    expect(result).toEqual({
      statusCode: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Linked entity not found",
      }),
    });
  });

  it("should reject when referenced product is missing", async () => {
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
        useCaseId: "the-use-case-id",
        environmentId: "the-environment-id",
        productId: "the-product-id",
        tags: [{ name: "the-tag-name", value: "the-tag-value" }],
      }),
    };

    ddbMock
      .on(BatchGetItemCommand, {
        RequestItems: {
          MockUseCasesTable: {
            Keys: [
              {
                orgId: { S: "the-org-id" },
                id: { S: "the-use-case-id" },
              },
            ],
          },
          MockEnvironmentsTable: {
            Keys: [
              {
                orgId: { S: "the-org-id" },
                id: { S: "the-environment-id" },
              },
            ],
          },
          MockProductsTable: {
            Keys: [
              {
                orgId: { S: "the-org-id" },
                id: { S: "the-product-id" },
              },
            ],
          },
        },
      })
      .resolves({
        Responses: {
          MockUseCasesTable: [{}],
          MockEnvironmentsTable: [{}],
          MockProductsTable: [],
        },
      });
    const result = await handleAnyRequest(event as APIGatewayProxyEvent);

    expect(result).toEqual({
      statusCode: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message: "Linked entity not found",
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
    test_rejection_if_missing_authorizer(
      ddbMock,
      handleAnyRequest,
      "123",
      "GET",
    );
  });

  it("should reject queries with no orgId in claims", async () => {
    test_rejection_if_missing_orgId(ddbMock, handleAnyRequest, "123", "GET");
  });

  it("should handle not found benchmark-definitions", async () => {
    const eventWithId: Partial<APIGatewayProxyEvent> = {
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
        id: "unknown-benchmark-definition-id",
      },
    };

    ddbMock.resolves({});
    const result = await handleAnyRequest(eventWithId as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(GetItemCommand, {
      TableName: "MockBenchmarkDefinitionsTable",
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
          lastUploadedTimestamp: { N: "1706201101633" },
        },
      });
    const result = await handleAnyRequest(eventWithId as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(GetItemCommand, {
      TableName: "MockBenchmarkDefinitionsTable",
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
        lastUploadedTimestamp: 1706201101633,
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
    test_rejection_if_not_json_content_type(
      ddbMock,
      handleAnyRequest,
      "123",
      "PUT",
    );
  });

  it("should reject queries with no authorizer", async () => {
    test_rejection_if_missing_authorizer(
      ddbMock,
      handleAnyRequest,
      "123",
      "PUT",
    );
  });

  it("should reject queries with no orgId in claims", async () => {
    test_rejection_if_missing_orgId(ddbMock, handleAnyRequest, "123", "PUT");
  });

  it("should handle missing benchmark-definition id", async () => {
    test_rejection_if_missing_defn_id(ddbMock, handleAnyRequest, "PUT");
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
        id: "path-parameter-benchmark-definition-id",
      },
      body: JSON.stringify({
        id: "json-body-benchmark-definition-id",
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

  it("should update benchmark-definition with user-provided data", async () => {
    const eventWithId: Partial<APIGatewayProxyEvent> = {
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
        id: "existing-benchmark-definition-id",
      },
      body: JSON.stringify({
        id: "existing-benchmark-definition-id",
        useCaseId: "the-updated-use-case-id",
        environmentId: "the-updated-environment-id",
        productId: "the-updated-product-id",
        jenkinsJobUrl: "the-jenkins-job-url",
        lastUploadedTimestamp: 123456,
        tags: [{ name: "the-tag-name", value: "the-tag-value" }],
      }),
    };

    const result = await handleAnyRequest(eventWithId as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(PutItemCommand, {
      ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      TableName: "MockBenchmarkDefinitionsTable",
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
        lastUploadedTimestamp: { N: "1706201101633" },
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
        lastUploadedTimestamp: 1706201101633,
      }),
    });
  });

  it("should not overwrite missing benchmark-definition", async () => {
    const eventWithId: Partial<APIGatewayProxyEvent> = {
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

    ddbMock.callsFake((input) => {
      throw new ConditionalCheckFailedException({
        message: "mocked rejection",
        $metadata: {},
      });
    });

    const result = await handleAnyRequest(eventWithId as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(PutItemCommand, {
      ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      TableName: "MockBenchmarkDefinitionsTable",
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
        lastUploadedTimestamp: { N: "1706201101633" },
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
    test_rejection_if_missing_authorizer(
      ddbMock,
      handleAnyRequest,
      "123",
      "DELETE",
    );
  });

  it("should reject queries with no orgId in claims", async () => {
    test_rejection_if_missing_orgId(ddbMock, handleAnyRequest, "123", "DELETE");
  });

  it("should handle missing benchmark-definition id", async () => {
    test_rejection_if_missing_defn_id(ddbMock, handleAnyRequest, "DELETE");
  });

  it("should delete identified benchmark-definition", async () => {
    const eventWithId: Partial<APIGatewayProxyEvent> = {
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
        id: "existing-benchmark-definition-id",
      },
    };

    const result = await handleAnyRequest(eventWithId as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(DeleteItemCommand, {
      ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      TableName: "MockBenchmarkDefinitionsTable",
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
        id: "existing-benchmark-definition-id",
      },
    };

    ddbMock.callsFake((input) => {
      throw new ConditionalCheckFailedException({
        message: "mocked rejection",
        $metadata: {},
      });
    });

    const result = await handleAnyRequest(eventWithId as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(DeleteItemCommand, {
      ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      TableName: "MockBenchmarkDefinitionsTable",
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
    test_rejection_if_missing_authorizer(
      ddbMock,
      handleAnyRequest,
      undefined,
      "GET",
    );
  });

  it("should reject queries with no orgId in claims", async () => {
    test_rejection_if_missing_orgId(
      ddbMock,
      handleAnyRequest,
      undefined,
      "GET",
    );
  });

  it("should list all benchmark-definitions", async () => {
    const eventWithId: Partial<APIGatewayProxyEvent> = {
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
        TableName: "MockBenchmarkDefinitionsTable",
        ExpressionAttributeNames: {
          "#O": "orgId",
          "#I": "id",
          "#UI": "useCaseId",
          "#EI": "environmentId",
          "#PI": "productId",
          "#J": "jenkinsJobUrl",
          "#T": "tags",
          "#L": "lastUploadedTimestamp",
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
            lastUploadedTimestamp: { N: "1706201101633" },
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
            lastUploadedTimestamp: { N: "1706201101632" },
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
            lastUploadedTimestamp: { N: "1706201101631" },
          },
        ],
      });
    const result = await handleAnyRequest(eventWithId as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(1);
    expect(ddbMock).toHaveReceivedCommandWith(ScanCommand, {
      TableName: "MockBenchmarkDefinitionsTable",
      ExpressionAttributeNames: {
        "#O": "orgId",
        "#I": "id",
        "#UI": "useCaseId",
        "#EI": "environmentId",
        "#PI": "productId",
        "#J": "jenkinsJobUrl",
        "#T": "tags",
        "#L": "lastUploadedTimestamp",
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
          lastUploadedTimestamp: 1706201101633,
        },
        {
          id: "benchmark-definition-id-2",
          useCaseId: "the-use-case-id-2",
          environmentId: "the-environment-id-2",
          productId: "the-product-id-2",
          jenkinsJobUrl: "the-jenkins-job-url-2",
          tags: [{ name: "the-tag-name", value: "the-tag-value" }],
          lastUploadedTimestamp: 1706201101632,
        },
        {
          id: "benchmark-definition-id-3",
          useCaseId: "the-use-case-id-3",
          environmentId: "the-environment-id-3",
          productId: "the-product-id-3",
          jenkinsJobUrl: "the-jenkins-job-url-3",
          tags: [{ name: "the-tag-name", value: "the-tag-value" }],
          lastUploadedTimestamp: 1706201101631,
        },
      ]),
    });
  });
});

async function test_rejection_if_missing_defn_id(
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
