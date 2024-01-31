import { extractOrgId, makeApiGwResponse } from "../api-gateway-util";
import { generateUuid } from "../uuid-generator";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  DynamoDBClient,
  ScanCommand,
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  ConditionalCheckFailedException,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { Environment, EnvironmentKey } from "../model/Environment";
import { StatusCodes } from "http-status-codes";
import { environmentsTableName } from "../environment-variables";

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

export const handleAnyRequest = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const productId: string | undefined = event.pathParameters?.id;
  const method: string = event.httpMethod;
  console.debug({
    event: "Dispatching query",
    data: {
      httpMethod: method,
      productId: productId,
    },
  });
  if (productId === undefined && method === "GET") {
    return await handleGetAllRequest(event);
  } else if (productId === undefined && method === "POST") {
    return await handlePostRequest(event);
  } else if (method === "GET") {
    return await handleGetRequest(event);
  } else if (method === "PUT") {
    return await handlePutRequest(event);
  } else if (method === "DELETE") {
    return await handleDeleteRequest(event);
  } else {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Unknown path/method combination",
    });
  }
};

const handleGetAllRequest = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const orgId: string | undefined = extractOrgId(event);
  if (orgId === undefined) {
    return makeApiGwResponse(StatusCodes.UNAUTHORIZED, {
      message: "Missing orgId",
    });
  }
  console.debug({ event: "Extracted orgId", data: orgId });

  try {
    const response = await ddbDocClient.send(
      new ScanCommand({
        TableName: environmentsTableName,
        FilterExpression: "orgId = :O",
        ExpressionAttributeValues: {
          ":O": { S: orgId },
        },
        ProjectionExpression: "#O, #I, #N, #T",
        ExpressionAttributeNames: {
          "#O": "orgId",
          "#I": "id",
          "#N": "name",
          "#T": "tags",
        },
      }),
    );
    const environments =
      response.Items?.map((item) =>
        Environment.fromAttributeValues(item),
      ).filter((u) => u !== undefined) || [];
    console.debug({ event: "Fetched environments", data: environments });
    return makeApiGwResponse(
      StatusCodes.OK,
      environments.map((u) => u.toApiModel()),
    );
  } catch (err) {
    console.error({ event: "Failed to fetch environments", data: err.stack });
    return makeApiGwResponse(StatusCodes.INTERNAL_SERVER_ERROR, {
      message: "Internal Server Error",
    });
  }
};

const handleGetRequest = async (
  event: APIGatewayProxyEvent,
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
        TableName: environmentsTableName,
        Key: environmentKey.toAttributeValues(),
      }),
    );
    const environment = Environment.fromAttributeValues(response.Item);
    console.debug({ event: "Fetched environment", data: environment });
    if (environment === undefined) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, { message: "Not Found" });
    } else {
      return makeApiGwResponse(StatusCodes.OK, environment.toApiModel());
    }
  } catch (err) {
    console.error({ event: "Failed to fetch environment", data: err.stack });
    return makeApiGwResponse(StatusCodes.INTERNAL_SERVER_ERROR, {
      message: "Internal Server Error",
    });
  }
};

const handlePostRequest = async (
  event: APIGatewayProxyEvent,
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
        TableName: environmentsTableName,
        Item: environment.toAttributeValues(),
      }),
    );
    console.debug({ event: "Added environment" });
    return makeApiGwResponse(StatusCodes.OK, parsedEnvironment);
  } catch (err) {
    console.error({ event: "Failed to add environment", data: err.stack });
    return makeApiGwResponse(StatusCodes.INTERNAL_SERVER_ERROR, {
      message: "Internal Server Error",
    });
  }
};

const handlePutRequest = async (
  event: APIGatewayProxyEvent,
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
        TableName: environmentsTableName,
        Item: environment.toAttributeValues(),
        ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      }),
    );
    console.debug({ event: "Updated environment" });
    return makeApiGwResponse(StatusCodes.OK, parsedEnvironment);
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, {
        message: "Not Found",
      });
    } else {
      console.error({ event: "Failed to update environment", data: err.stack });
      return makeApiGwResponse(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Internal Server Error",
      });
    }
  }
};

const handleDeleteRequest = async (
  event: APIGatewayProxyEvent,
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
        TableName: environmentsTableName,
        Key: environmentKey.toAttributeValues(),
        ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      }),
    );
    console.debug({ event: "Deleted environment" });
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, {
        message: "Not Found",
      });
    } else {
      console.error({ event: "Failed to delete environment", data: err.stack });
      return makeApiGwResponse(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Internal Server Error",
      });
    }
  }

  return makeApiGwResponse(StatusCodes.OK, {});
};
