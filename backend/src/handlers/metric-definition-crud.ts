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
import { MetricDefinition, MetricDefinitionKey } from "../model/MetricDefinition";
import { StatusCodes } from "http-status-codes";

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);
const metricDefinitionTableName = process.env.METRIC_DEFINITION_TABLE_NAME;

export const handleGetAllRequest = async (
  event: APIGatewayProxyEvent
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
        TableName: metricDefinitionTableName,
        FilterExpression: "orgId = :O",
        ExpressionAttributeValues: {
          ":O": { S: orgId },
        },
        ProjectionExpression: "#O, #I, #N, #U, #R, #T",
        ExpressionAttributeNames: {
          "#O": "orgId",
          "#I": "id",
          "#N": "name",
          "#U": "unit",
          "#R": "regressionDirection",
          "#T": "tags",
        },
      })
    );
    const metricDefinitions =
      response.Items?.map((item) => MetricDefinition.fromAttributeValues(item)).filter(
        (u) => u !== undefined
      ) || [];
    console.debug({ event: "Fetched metricDefinitions", data: metricDefinitions });
    return makeApiGwResponse(
      StatusCodes.OK,
      metricDefinitions.map((u) => u.toApiModel())
    );
  } catch (err) {
    console.log("Failed to fetch metricDefinition", err.stack);
    return makeApiGwResponse(StatusCodes.INTERNAL_SERVER_ERROR, {
      message: "Internal Server Error",
    });
  }
};

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

  const metricDefinitionId: string | undefined = event.pathParameters?.id;
  if (metricDefinitionId === undefined) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing id",
    });
  }
  console.debug({ event: "Extracted metricDefinitionId", data: metricDefinitionId });
  const metricDefinitionKey = new MetricDefinitionKey(orgId, metricDefinitionId);

  try {
    const response = await ddbDocClient.send(
      new GetItemCommand({
        TableName: metricDefinitionTableName,
        Key: metricDefinitionKey.toAttributeValues(),
      })
    );
    const metricDefinition = MetricDefinition.fromAttributeValues(response.Item);
    console.debug({ event: "Fetched metricDefinition", data: metricDefinition });
    if (metricDefinition === undefined) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, { message: "Not Found" });
    } else {
      return makeApiGwResponse(StatusCodes.OK, metricDefinition.toApiModel());
    }
  } catch (err) {
    console.log("Failed to fetch metricDefinition", err.stack);
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

  const parsedMetricDefinition = JSON.parse(event.body || "{}");
  console.debug({ event: "Parsed metricDefinition", data: parsedMetricDefinition });
  parsedMetricDefinition["id"] = generateUuid();
  const metricDefinition = MetricDefinition.fromApiModel(orgId, parsedMetricDefinition);

  try {
    await ddbDocClient.send(
      new PutItemCommand({
        TableName: metricDefinitionTableName,
        Item: metricDefinition.toAttributeValues(),
      })
    );
    console.debug({ event: "Added metricDefinition" });
    return makeApiGwResponse(StatusCodes.OK, parsedMetricDefinition);
  } catch (err) {
    console.log("Failed to add metricDefinition", err.stack);
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

  const metricDefinitionId: string | undefined = event.pathParameters?.id;
  if (metricDefinitionId === undefined) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing id",
    });
  }
  console.debug({ event: "Extracted metricDefinitionId", data: metricDefinitionId });

  const parsedMetricDefinition = JSON.parse(event.body || "{}");
  console.debug({ event: "Parsed metricDefinition", data: parsedMetricDefinition });
  const metricDefinition = MetricDefinition.fromApiModel(orgId, parsedMetricDefinition);

  if (parsedMetricDefinition["id"] !== metricDefinitionId) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Id mismatch",
    });
  }

  try {
    await ddbDocClient.send(
      new PutItemCommand({
        TableName: metricDefinitionTableName,
        Item: metricDefinition.toAttributeValues(),
        ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      })
    );
    console.debug({ event: "Updated metricDefinition" });
    return makeApiGwResponse(StatusCodes.OK, parsedMetricDefinition);
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, {
        message: "Not Found",
      });
    } else {
      console.log("Failed to update metricDefinition", err.stack);
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

  const metricDefinitionId: string | undefined = event.pathParameters?.id;
  if (metricDefinitionId === undefined) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing id",
    });
  }
  console.debug({ event: "Extracted metricDefinitionId", data: metricDefinitionId });
  const metricDefinitionKey = new MetricDefinitionKey(orgId, metricDefinitionId);

  try {
    await ddbDocClient.send(
      new DeleteItemCommand({
        TableName: metricDefinitionTableName,
        Key: metricDefinitionKey.toAttributeValues(),
        ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      })
    );
    console.debug({ event: "Deleted metricDefinition" });
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, {
        message: "Not Found",
      });
    } else {
      console.log("Failed to delete metricDefinition", err.stack);
      return makeApiGwResponse(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Internal Server Error",
      });
    }
  }

  return makeApiGwResponse(StatusCodes.OK, {});
};
