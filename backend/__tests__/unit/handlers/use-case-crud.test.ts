import { handlePostRequest } from "../../../src/handlers/use-case-crud";

import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
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
    };
    expect(result).toEqual(expectedResult);
  });

  it("should reject queries with no authorizer", async () => {
    const eventWithoutAuthorizer: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      requestContext: {},
    };
    const resultWithoutAuthorizer = await handlePostRequest(
      eventWithoutAuthorizer as APIGatewayProxyEvent
    );
    expect(resultWithoutAuthorizer).toEqual({
      statusCode: 500,
      body: JSON.stringify({
        message: "Missing orgId",
      }),
    });
  });

  it("should reject queries with no orgId in claims", async () => {
    const eventWithoutOrgId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      requestContext: {
        authorizer: {},
      },
    };
    const resultWithoutOrgId = await handlePostRequest(
      eventWithoutOrgId as APIGatewayProxyEvent
    );
    expect(resultWithoutOrgId).toEqual({
      statusCode: 500,
      body: JSON.stringify({
        message: "Missing orgId",
      }),
    });
  });

  it("should override any provided use-case id", async () => {
    const eventWithId: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
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

    console.log(result);
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
