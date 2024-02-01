import {
  ConditionalCheckFailedException,
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  type APIGatewayProxyEvent,
  type APIGatewayProxyResult,
} from "aws-lambda";
import { StatusCodes } from "http-status-codes";

import { extractOrgId, makeApiGwResponse } from "../api-gateway-util";
import { useCasesTableName } from "../environment-variables";
import { type ApiUseCase, UseCase, UseCaseKey } from "../model/UseCase";
import { generateUuid } from "../uuid-generator";

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

export const handleAnyRequest = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const useCaseId: string | undefined = event.pathParameters?.id;
  const method: string = event.httpMethod;
  console.debug({
    event: "Dispatching query",
    data: {
      httpMethod: method,
      useCaseId,
    },
  });
  if (useCaseId === undefined && method === "GET") {
    return await handleGetAllRequest(event);
  } else if (useCaseId === undefined && method === "POST") {
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
        TableName: useCasesTableName,
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
    const useCases =
      response.Items?.map((item) => UseCase.fromAttributeValues(item)).filter(
        (u) => u !== undefined,
      ) ?? [];
    console.debug({
      event: "Number of use-cases fetched:",
      data: useCases.length,
    });
    return makeApiGwResponse(
      StatusCodes.OK,
      useCases.map((u) => u.toApiModel()),
    );
  } catch (err) {
    console.error({ event: "Failed to fetch use-cases", data: err.stack });
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

  const useCaseId: string | undefined = event.pathParameters?.id;
  if (useCaseId === undefined) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing id",
    });
  }
  console.debug({ event: "Extracted useCaseId", data: useCaseId });
  const useCaseKey = new UseCaseKey(orgId, useCaseId);

  try {
    const response = await ddbDocClient.send(
      new GetItemCommand({
        TableName: useCasesTableName,
        Key: useCaseKey.toAttributeValues(),
      }),
    );
    const useCase = UseCase.fromAttributeValues(response.Item);
    console.debug({ event: "Fetched use-case", data: useCase });
    if (useCase === undefined) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, { message: "Not Found" });
    } else {
      return makeApiGwResponse(StatusCodes.OK, useCase.toApiModel());
    }
  } catch (err) {
    console.error({ event: "Failed to fetch use-case", data: err.stack });
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

  const parsedUseCase = JSON.parse(event.body ?? "{}");
  parsedUseCase.id = generateUuid();
  const useCase = UseCase.fromApiModel(orgId, parsedUseCase as ApiUseCase);
  console.debug({ event: "Parsed use-case", data: useCase });

  try {
    await ddbDocClient.send(
      new PutItemCommand({
        TableName: useCasesTableName,
        Item: useCase.toAttributeValues(),
      }),
    );
    console.debug({ event: "Added use-case" });
    return makeApiGwResponse(StatusCodes.OK, parsedUseCase);
  } catch (err) {
    console.error({ event: "Failed to add use-case", data: err.stack });
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

  const useCaseId: string | undefined = event.pathParameters?.id;
  if (useCaseId === undefined) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing id",
    });
  }
  console.debug({ event: "Extracted useCaseId", data: useCaseId });

  const parsedUseCase = JSON.parse(event.body ?? "{}");
  if (parsedUseCase.id !== useCaseId) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Id mismatch",
    });
  }
  const useCase = UseCase.fromApiModel(orgId, parsedUseCase as ApiUseCase);
  console.debug({ event: "Parsed use-case", data: useCase });

  try {
    await ddbDocClient.send(
      new PutItemCommand({
        TableName: useCasesTableName,
        Item: useCase.toAttributeValues(),
        ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      }),
    );
    console.debug({ event: "Updated use-case" });
    return makeApiGwResponse(StatusCodes.OK, parsedUseCase);
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, {
        message: "Not Found",
      });
    } else {
      console.error({ event: "Failed to update use-case", data: err.stack });
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

  const useCaseId: string | undefined = event.pathParameters?.id;
  if (useCaseId === undefined) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing id",
    });
  }
  console.debug({ event: "Extracted useCaseId", data: useCaseId });
  const useCaseKey = new UseCaseKey(orgId, useCaseId);

  try {
    await ddbDocClient.send(
      new DeleteItemCommand({
        TableName: useCasesTableName,
        Key: useCaseKey.toAttributeValues(),
        ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      }),
    );
    console.debug({ event: "Deleted use-case" });
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, {
        message: "Not Found",
      });
    } else {
      console.error({ event: "Failed to delete use-case", data: err.stack });
      return makeApiGwResponse(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Internal Server Error",
      });
    }
  }

  return makeApiGwResponse(StatusCodes.OK, {});
};
