import {
  handlePostRequest,
  handlePutRequest,
  handleGetRequest,
  handleDeleteRequest,
} from "../../../src/handlers/use-case-crud";

import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { APIGatewayProxyEvent } from "aws-lambda";

jest.mock("../../../src/handlers/uuid-generator", () => {
  const originalModule = jest.requireActual(
    "../../../src/handlers/uuid-generator"
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
    const expectedResult = {
      statusCode: 415,
      body: JSON.stringify({
        message: "Unsupported Media Type",
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    };
    expect(result).toEqual(expectedResult);
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

  it("should override user-provided use-case id", async () => {
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

  it("should handle missing use-case id", async () => {
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

  it("should handle not found use-cases", async () => {
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
        id: "unknown-use-case-id",
      },
    };

    ddbMock
      .on(GetCommand, {
        Key: {
          orgId: "the-org-id",
          id: "unknown-use-case-id",
        },
      })
      .resolves({});
    const result = await handleGetRequest(eventWithId as APIGatewayProxyEvent);

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

  it("should find existing use-cases", async () => {
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
        id: "existing-use-case-id",
      },
    };

    ddbMock
      .on(GetCommand, {
        Key: {
          orgId: "the-org-id",
          id: "existing-use-case-id",
        },
      })
      .resolves({
        Item: {
          orgId: "the-org-id",
          id: "existing-use-case-id",
          name: "the-returned-name",
          description: "the-returned-description",
          tags: [
            { name: "the-returned-tag-name", value: "the-returned-tag-value" },
          ],
        },
      });
    const result = await handleGetRequest(eventWithId as APIGatewayProxyEvent);

    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        id: "existing-use-case-id",
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
    const expectedResult = {
      statusCode: 415,
      body: JSON.stringify({
        message: "Unsupported Media Type",
      }),
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    };
    expect(result).toEqual(expectedResult);
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

  it("should handle missing use-case id", async () => {
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
        id: "path-parameter-use-case-id",
      },
      body: JSON.stringify({
        id: "json-body-use-case-id",
      }),
    };

    const result = await handlePutRequest(
      eventWithoutId as APIGatewayProxyEvent
    );

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

  it("should overwrite use-case with user-provided data", async () => {
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
        id: "existing-use-case-id",
      },
      body: JSON.stringify({
        id: "existing-use-case-id",
        name: "the-updated-name",
        description: "the-updated-description",
        tags: [{ name: "the-tag-name", value: "the-tag-value" }],
      }),
    };

    const result = await handlePutRequest(eventWithId as APIGatewayProxyEvent);

    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        id: "existing-use-case-id",
        name: "the-updated-name",
        description: "the-updated-description",
        tags: [{ name: "the-tag-name", value: "the-tag-value" }],
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

  it("should handle missing use-case id", async () => {
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

  it("should delete identified use-case", async () => {
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
        id: "existing-use-case-id",
      },
    };

    const result = await handlePutRequest(eventWithId as APIGatewayProxyEvent);

    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({}),
    });
  });
});
