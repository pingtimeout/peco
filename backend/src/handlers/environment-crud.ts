import { extractOrgId, makeApiGwResponse } from "../api-gateway-util";
import { generateUuid } from "../uuid-generator";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  ConditionalCheckFailedException,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Environment, EnvironmentKey } from "../model/Environment";
import { StatusCodes } from "http-status-codes";

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);
const environmentTableName = process.env.ENVIRONMENT_TABLE_NAME;

export const handleGetRequest = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const orgId: string | undefined = extractOrgId(event);
  if (orgId === undefined) {
    return makeApiGwResponse(StatusCodes.UNAUTHORIZED, {
      message: "Missing orgId",
    });
  }
  console.debug({ event: "Extracted orgId", data: orgId });

  const environmentId: string | undefined = event.pathParameters?.id;
  if (environmentId === undefined) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing id",
    });
  }
  console.debug({ event: "Extracted environmentId", data: environmentId });
  const environmentKey = new EnvironmentKey(orgId, environmentId);

  try {
    const response = await ddbDocClient.send(
      new GetItemCommand({
        TableName: environmentTableName,
        Key: environmentKey.toAttributeValues(),
      })
    );
    const environment = Environment.fromAttributeValues(response.Item);
    console.debug({ event: "Fetched environment", data: environment });
    if (environment === undefined) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, { message: "Not Found" });
    } else {
      return makeApiGwResponse(StatusCodes.OK, environment.toApiModel());
    }
  } catch (err) {
    console.log("Failed to fetch environment", err.stack);
    return makeApiGwResponse(StatusCodes.INTERNAL_SERVER_ERROR, {
      message: "Internal Server Error",
    });
  }
};

export const handlePostRequest = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const contentType = event.headers["content-type"];
  if (contentType !== "application/json") {
    return makeApiGwResponse(StatusCodes.UNSUPPORTED_MEDIA_TYPE, {
      message: "Unsupported Media Type",
    });
  }

  const orgId: string | undefined = extractOrgId(event);
  if (orgId === undefined) {
    return makeApiGwResponse(StatusCodes.UNAUTHORIZED, {
      message: "Missing orgId",
    });
  }
  console.debug({ event: "Extracted orgId", data: orgId });

  const parsedEnvironment = JSON.parse(event.body || "{}");
  console.debug({ event: "Parsed environment", data: parsedEnvironment });
  parsedEnvironment["id"] = generateUuid();
  const environment = Environment.fromApiModel(orgId, parsedEnvironment);

  try {
    await ddbDocClient.send(
      new PutItemCommand({
        TableName: environmentTableName,
        Item: environment.toAttributeValues(),
      })
    );
    console.debug({ event: "Added environment" });
    return makeApiGwResponse(StatusCodes.OK, parsedEnvironment);
  } catch (err) {
    console.log("Failed to add environment", err.stack);
    return makeApiGwResponse(StatusCodes.INTERNAL_SERVER_ERROR, {
      message: "Internal Server Error",
    });
  }
};

export const handlePutRequest = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const contentType = event.headers["content-type"];
  if (contentType !== "application/json") {
    return makeApiGwResponse(StatusCodes.UNSUPPORTED_MEDIA_TYPE, {
      message: "Unsupported Media Type",
    });
  }

  const orgId: string | undefined = extractOrgId(event);
  if (orgId === undefined) {
    return makeApiGwResponse(StatusCodes.UNAUTHORIZED, {
      message: "Missing orgId",
    });
  }
  console.debug({ event: "Extracted orgId", data: orgId });

  const environmentId: string | undefined = event.pathParameters?.id;
  if (environmentId === undefined) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing id",
    });
  }
  console.debug({ event: "Extracted environmentId", data: environmentId });

  const parsedEnvironment = JSON.parse(event.body || "{}");
  console.debug({ event: "Parsed environment", data: parsedEnvironment });
  const environment = Environment.fromApiModel(orgId, parsedEnvironment);

  if (parsedEnvironment["id"] !== environmentId) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Id mismatch",
    });
  }

  try {
    await ddbDocClient.send(
      new PutItemCommand({
        TableName: environmentTableName,
        Item: environment.toAttributeValues(),
        ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      })
    );
    console.debug({ event: "Updated environment" });
    return makeApiGwResponse(StatusCodes.OK, parsedEnvironment);
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, {
        message: "Not Found",
      });
    } else {
      console.log("Failed to update environment", err.stack);
      return makeApiGwResponse(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Internal Server Error",
      });
    }
  }
};

export const handleDeleteRequest = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const orgId: string | undefined = extractOrgId(event);
  if (orgId === undefined) {
    return makeApiGwResponse(StatusCodes.UNAUTHORIZED, {
      message: "Missing orgId",
    });
  }
  console.debug({ event: "Extracted orgId", data: orgId });

  const environmentId: string | undefined = event.pathParameters?.id;
  if (environmentId === undefined) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing id",
    });
  }
  console.debug({ event: "Extracted environmentId", data: environmentId });
  const environmentKey = new EnvironmentKey(orgId, environmentId);

  try {
    await ddbDocClient.send(
      new DeleteItemCommand({
        TableName: environmentTableName,
        Key: environmentKey.toAttributeValues(),
        ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      })
    );
    console.debug({ event: "Deleted environment" });
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, {
        message: "Not Found",
      });
    } else {
      console.log("Failed to delete environment", err.stack);
      return makeApiGwResponse(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Internal Server Error",
      });
    }
  }

  return makeApiGwResponse(StatusCodes.OK, {});
};
