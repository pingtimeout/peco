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
import { UseCase, UseCaseKey } from "../model/UseCase";
import { StatusCodes } from "http-status-codes";

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);
const useCaseTableName = process.env.USE_CASE_TABLE_NAME;

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
        TableName: useCaseTableName,
        Key: useCaseKey.toAttributeValues(),
      })
    );
    const useCase = UseCase.fromAttributeValues(response.Item);
    console.debug({ event: "Fetched use-case", data: useCase });
    if (useCase === undefined) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, { message: "Not Found" });
    } else {
      return makeApiGwResponse(StatusCodes.OK, useCase.toApiModel());
    }
  } catch (err) {
    console.log("Failed to fetch use-case", err.stack);
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

  const parsedUseCase = JSON.parse(event.body || "{}");
  console.debug({ event: "Parsed use-case", data: parsedUseCase });
  parsedUseCase["id"] = generateUuid();
  const useCase = UseCase.fromApiModel(orgId, parsedUseCase);

  try {
    await ddbDocClient.send(
      new PutItemCommand({
        TableName: useCaseTableName,
        Item: useCase.toAttributeValues(),
      })
    );
    console.debug({ event: "Added use-case" });
    return makeApiGwResponse(StatusCodes.OK, parsedUseCase);
  } catch (err) {
    console.log("Failed to add use-case", err.stack);
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

  const useCaseId: string | undefined = event.pathParameters?.id;
  if (useCaseId === undefined) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing id",
    });
  }
  console.debug({ event: "Extracted useCaseId", data: useCaseId });

  const parsedUseCase = JSON.parse(event.body || "{}");
  console.debug({ event: "Parsed use-case", data: parsedUseCase });
  const useCase = UseCase.fromApiModel(orgId, parsedUseCase);

  if (parsedUseCase["id"] !== useCaseId) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Id mismatch",
    });
  }

  try {
    await ddbDocClient.send(
      new PutItemCommand({
        TableName: useCaseTableName,
        Item: useCase.toAttributeValues(),
        ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      })
    );
    console.debug({ event: "Updated use-case" });
    return makeApiGwResponse(StatusCodes.OK, parsedUseCase);
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, {
        message: "Not Found",
      });
    } else {
      console.log("Failed to update use-case", err.stack);
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
        TableName: useCaseTableName,
        Key: useCaseKey.toAttributeValues(),
        ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      })
    );
    console.debug({ event: "Deleted use-case" });
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, {
        message: "Not Found",
      });
    } else {
      console.log("Failed to delete use-case", err.stack);
      return makeApiGwResponse(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Internal Server Error",
      });
    }
  }

  return makeApiGwResponse(StatusCodes.OK, {});
};
