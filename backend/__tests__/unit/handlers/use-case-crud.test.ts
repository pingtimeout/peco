import { handlePostRequest } from "../../../src/handlers/use-case-crud.mjs";

import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { APIGatewayProxyEvent } from "aws-lambda";

describe("Test handlePostRequest", () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    ddbMock.reset();
  });

  it("should reject queries with no orgId", async () => {
    const apiGatewayEvent: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
    };
    const result = await handlePostRequest(apiGatewayEvent as APIGatewayProxyEvent);
    const expectedResult = {
      statusCode: 415,
      body: JSON.stringify({
        message: "Unsupported Media Type",
      }),
    };
    expect(result).toEqual(expectedResult);
  });
});
