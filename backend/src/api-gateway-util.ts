import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export function extractOrgId(event: APIGatewayProxyEvent): string | undefined {
  const claims = event.requestContext?.authorizer?.claims || {};
  return claims["custom:orgId"];
}

export function makeApiGwResponse(
  statusCode: number,
  body: any,
): APIGatewayProxyResult {
  return {
    statusCode: statusCode,
    body: JSON.stringify(body),
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  };
}
