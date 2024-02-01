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
import { metricDefinitionsTableName } from "../environment-variables";
import {
  MetricDefinition,
  MetricDefinitionKey,
} from "../model/MetricDefinition";
import { generateUuid } from "../uuid-generator";

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
      productId,
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
        TableName: metricDefinitionsTableName,
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
      }),
    );
    const metricDefinitions =
      response.Items?.map((item) =>
        MetricDefinition.fromAttributeValues(item),
      ).filter((u) => u !== undefined) || [];
    console.debug({
      event: "Fetched metricDefinitions",
      data: metricDefinitions,
    });
    return makeApiGwResponse(
      StatusCodes.OK,
      metricDefinitions.map((u) => u.toApiModel()),
    );
  } catch (err) {
    console.error({
      event: "Failed to fetch metric-definitions",
      data: err.stack,
    });
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

  const metricDefinitionId: string | undefined = event.pathParameters?.id;
  if (metricDefinitionId === undefined) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing id",
    });
  }
  console.debug({
    event: "Extracted metricDefinitionId",
    data: metricDefinitionId,
  });
  const metricDefinitionKey = new MetricDefinitionKey(
    orgId,
    metricDefinitionId,
  );

  try {
    const response = await ddbDocClient.send(
      new GetItemCommand({
        TableName: metricDefinitionsTableName,
        Key: metricDefinitionKey.toAttributeValues(),
      }),
    );
    const metricDefinition = MetricDefinition.fromAttributeValues(
      response.Item,
    );
    console.debug({
      event: "Fetched metricDefinition",
      data: metricDefinition,
    });
    if (metricDefinition === undefined) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, { message: "Not Found" });
    } else {
      return makeApiGwResponse(StatusCodes.OK, metricDefinition.toApiModel());
    }
  } catch (err) {
    console.error({
      event: "Failed to fetch metric-definition",
      data: err.stack,
    });
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

  const parsedMetricDefinition = JSON.parse(event.body ?? "{}");
  console.debug({
    event: "Parsed metricDefinition",
    data: parsedMetricDefinition,
  });
  parsedMetricDefinition.id = generateUuid();
  const metricDefinition = MetricDefinition.fromApiModel(
    orgId,
    parsedMetricDefinition,
  );

  try {
    await ddbDocClient.send(
      new PutItemCommand({
        TableName: metricDefinitionsTableName,
        Item: metricDefinition.toAttributeValues(),
      }),
    );
    console.debug({ event: "Added metricDefinition" });
    return makeApiGwResponse(StatusCodes.OK, parsedMetricDefinition);
  } catch (err) {
    console.error({
      event: "Failed to add metric-definition",
      data: err.stack,
    });
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

  const metricDefinitionId: string | undefined = event.pathParameters?.id;
  if (metricDefinitionId === undefined) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing id",
    });
  }
  console.debug({
    event: "Extracted metricDefinitionId",
    data: metricDefinitionId,
  });

  const parsedMetricDefinition = JSON.parse(event.body ?? "{}");
  console.debug({
    event: "Parsed metricDefinition",
    data: parsedMetricDefinition,
  });
  const metricDefinition = MetricDefinition.fromApiModel(
    orgId,
    parsedMetricDefinition,
  );

  if (parsedMetricDefinition.id !== metricDefinitionId) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Id mismatch",
    });
  }

  try {
    await ddbDocClient.send(
      new PutItemCommand({
        TableName: metricDefinitionsTableName,
        Item: metricDefinition.toAttributeValues(),
        ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      }),
    );
    console.debug({ event: "Updated metricDefinition" });
    return makeApiGwResponse(StatusCodes.OK, parsedMetricDefinition);
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, {
        message: "Not Found",
      });
    } else {
      console.error({
        event: "Failed to update metric-definition",
        data: err.stack,
      });
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

  const metricDefinitionId: string | undefined = event.pathParameters?.id;
  if (metricDefinitionId === undefined) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing id",
    });
  }
  console.debug({
    event: "Extracted metricDefinitionId",
    data: metricDefinitionId,
  });
  const metricDefinitionKey = new MetricDefinitionKey(
    orgId,
    metricDefinitionId,
  );

  try {
    await ddbDocClient.send(
      new DeleteItemCommand({
        TableName: metricDefinitionsTableName,
        Key: metricDefinitionKey.toAttributeValues(),
        ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      }),
    );
    console.debug({ event: "Deleted metricDefinition" });
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, {
        message: "Not Found",
      });
    } else {
      console.error({
        event: "Failed to delete metric-definition",
        data: err.stack,
      });
      return makeApiGwResponse(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Internal Server Error",
      });
    }
  }

  return makeApiGwResponse(StatusCodes.OK, {});
};
