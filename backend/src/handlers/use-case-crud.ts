import { extractOrgId, makeApiGwResponse } from "../api-gateway-util";
import { generateUuid } from "./uuid-generator";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);
const useCaseTableName = process.env.USE_CASE_TABLE_NAME;

export const handleGetRequest = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const orgId: string | undefined = extractOrgId(event);
  if (orgId === undefined) {
    return makeApiGwResponse(401, { message: "Missing orgId" });
  }
  console.debug({ event: "Extracted orgId", data: orgId });

  const useCaseId: string | undefined = event.pathParameters?.id;
  if (useCaseId === undefined) {
    return makeApiGwResponse(400, { message: "Missing id" });
  }
  console.debug({ event: "Extracted useCaseId", data: useCaseId });

  try {
    const response = await ddbDocClient.send(
      new GetCommand({
        TableName: useCaseTableName,
        Key: {
          orgId: orgId,
          id: useCaseId,
        },
      })
    );
    var useCase = response.Item;
    console.debug({ event: "Fetched use-case", data: useCase });
  } catch (err) {
    console.log("Failed to fetch use-case", err.stack);
    return makeApiGwResponse(500, { message: "Internal Server Error" });
  }

  if (useCase === undefined) {
    return makeApiGwResponse(404, { message: "Not Found" });
  } else {
    delete useCase["orgId"];
    return makeApiGwResponse(200, useCase);
  }
};

export const handlePostRequest = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const contentType = event.headers["content-type"];
  if (contentType !== "application/json") {
    return makeApiGwResponse(415, { message: "Unsupported Media Type" });
  }

  const orgId: string | undefined = extractOrgId(event);
  if (orgId === undefined) {
    return makeApiGwResponse(401, { message: "Missing orgId" });
  }
  console.debug({ event: "Extracted orgId", data: orgId });

  const useCase = JSON.parse(event.body || "{}");
  console.debug({ event: "Parsed use case", data: useCase });
  useCase["orgId"] = orgId;
  useCase["id"] = generateUuid();
  console.debug({ event: "Storable use case", data: useCase });

  try {
    const data = await ddbDocClient.send(
      new PutCommand({
        TableName: useCaseTableName,
        Item: useCase,
      })
    );
    console.debug({ event: "Added use-case" });
  } catch (err) {
    console.log("Failed to add use-case", err.stack);
    return makeApiGwResponse(500, { message: "Internal Server Error" });
  }

  delete useCase["orgId"];
  return makeApiGwResponse(200, useCase);
};

export const handlePutRequest = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const contentType = event.headers["content-type"];
  if (contentType !== "application/json") {
    return makeApiGwResponse(415, { message: "Unsupported Media Type" });
  }

  const orgId: string | undefined = extractOrgId(event);
  if (orgId === undefined) {
    return makeApiGwResponse(401, { message: "Missing orgId" });
  }
  console.debug({ event: "Extracted orgId", data: orgId });

  const useCase = JSON.parse(event.body || "{}");
  console.debug({ event: "Parsed use case", data: useCase });
  useCase["orgId"] = orgId;
  console.debug({ event: "Storable use case", data: useCase });

  try {
    const data = await ddbDocClient.send(
      new PutCommand({
        TableName: useCaseTableName,
        Item: useCase,
        ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)"
      })
    );
    console.debug({ event: "Updated use-case" });
  } catch (err) {
    console.log("Failed to add use-case", err.stack);
    return makeApiGwResponse(500, { message: "Internal Server Error" });
  }

  delete useCase["orgId"];
  return makeApiGwResponse(200, useCase);
};

// {orgId, id}
// name, description, tags (key, value)
