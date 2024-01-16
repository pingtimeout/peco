// @prettier

import { generateUuid } from "./uuid-generator";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);
const useCaseTableName = process.env.USE_CASE_TABLE_NAME;

export const handleGetRequest = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.debug({ event: "Received event", data: JSON.stringify(event) });
  const orgId: string = event.requestContext.authorizer!.claims["custom:orgId"];
  const useCaseId: string = event.pathParameters!.id!;
  return {
    statusCode: 200,
    body: '{"status": "Success during GET"}',
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  };
};

export const handlePostRequest = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const contentType = event.headers["content-type"];
  if (contentType !== "application/json") {
    return {
      statusCode: 415,
      body: JSON.stringify({ message: "Unsupported Media Type" }),
    };
  }

  const claims = event.requestContext.authorizer?.claims || {};
  const orgId = claims["custom:orgId"];
  console.debug({ event: "Extracted orgId", data: orgId });
  if(orgId === undefined) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Missing orgId" }),
    };
  }

  const useCase = JSON.parse(event.body || "{}");
  console.debug({ event: "Parsed use case", data: useCase });

  useCase["orgId"] = orgId;
  useCase["id"] = generateUuid();
  console.debug({ event: "Storable use case", data: JSON.stringify(useCase) });

  try {
    const data = await ddbDocClient.send(
      new PutCommand({
        TableName: useCaseTableName,
        Item: useCase,
      })
    );
    console.debug({ event: "Added use-case", data: JSON.stringify(useCase) });
  } catch (err) {
    console.log("Error", err.stack);
  }

  delete useCase["orgId"];
  return {
    statusCode: 200,
    body: JSON.stringify(useCase),
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  };
};

export const handlePutRequest = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  console.log("Received event: " + JSON.stringify(event));
  const orgId = event.requestContext.authorizer?.claims["custom:orgId"];
  console.log("User orgId is: " + orgId);
  return {
    statusCode: 200,
    body: '{"status": "Success during PUT"}',
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  };
};

// {orgId, id}
// name, description, tags (key, value)
