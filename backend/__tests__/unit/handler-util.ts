import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export async function test_rejection_if_not_json_content_type(
  ddbMock: any,
  requestHandler: (e: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>
) {
  const apiGatewayEvent: Partial<APIGatewayProxyEvent> = {
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
  };
  const result = await requestHandler(apiGatewayEvent as APIGatewayProxyEvent);
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
}

export async function test_rejection_if_missing_authorizer(
  ddbMock: any,
  requestHandler: (e: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>
) {
  const eventWithoutAuthorizer: Partial<APIGatewayProxyEvent> = {
    headers: {
      "content-type": "application/json",
    },
    // @ts-ignore
    requestContext: {},
  };
  const resultWithoutAuthorizer = await requestHandler(
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
}

export async function test_rejection_if_missing_orgId(
  ddbMock: any,
  requestHandler: (e: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>
) {
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
  const resultWithoutOrgId = await requestHandler(
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
}
