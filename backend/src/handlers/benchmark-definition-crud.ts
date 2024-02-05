import {
  BatchGetItemCommand,
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
import {
  benchmarkDefinitionsTableName,
  environmentsTableName,
  productsTableName,
  useCasesTableName,
} from "../environment-variables";
import {
  BenchmarkDefinition,
  BenchmarkDefinitionKey,
} from "../model/BenchmarkDefinition";
import { currentTimestamp } from "../time-source";
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
        TableName: benchmarkDefinitionsTableName.value,
        FilterExpression: "orgId = :O",
        ExpressionAttributeValues: {
          ":O": { S: orgId },
        },
        ProjectionExpression: "#O, #I, #UI, #EI, #PI, #J, #T, #L",
        ExpressionAttributeNames: {
          "#O": "orgId",
          "#I": "id",
          "#UI": "useCaseId",
          "#EI": "environmentId",
          "#PI": "productId",
          "#J": "jenkinsJobUrl",
          "#T": "tags",
          "#L": "lastUploadedTimestamp",
        },
      }),
    );
    const benchmarkDefinitions =
      response.Items?.map((item) =>
        BenchmarkDefinition.fromAttributeValues(item),
      ).filter((u) => u !== undefined) || [];
    console.debug({
      event: "Fetched benchmarkDefinitions",
      data: benchmarkDefinitions,
    });
    return makeApiGwResponse(
      StatusCodes.OK,
      benchmarkDefinitions.map((u) => u.toApiModel()),
    );
  } catch (err) {
    console.log("Failed to fetch benchmarkDefinition", err.stack);
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

  const benchmarkDefinitionId: string | undefined = event.pathParameters?.id;
  if (benchmarkDefinitionId === undefined) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing id",
    });
  }
  console.debug({
    event: "Extracted benchmarkDefinitionId",
    data: benchmarkDefinitionId,
  });
  const benchmarkDefinitionKey = new BenchmarkDefinitionKey(
    orgId,
    benchmarkDefinitionId,
  );

  try {
    const response = await ddbDocClient.send(
      new GetItemCommand({
        TableName: benchmarkDefinitionsTableName.value,
        Key: benchmarkDefinitionKey.toAttributeValues(),
      }),
    );
    const benchmarkDefinition = BenchmarkDefinition.fromAttributeValues(
      response.Item,
    );
    console.debug({
      event: "Fetched benchmarkDefinition",
      data: benchmarkDefinition,
    });
    if (benchmarkDefinition === undefined) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, { message: "Not Found" });
    } else {
      return makeApiGwResponse(
        StatusCodes.OK,
        benchmarkDefinition.toApiModel(),
      );
    }
  } catch (err) {
    console.log("Failed to fetch benchmarkDefinition", err.stack);
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

  const parsedBenchmarkDefinition = JSON.parse(event.body ?? "{}");
  console.debug({
    event: "Parsed benchmarkDefinition",
    data: parsedBenchmarkDefinition,
  });
  parsedBenchmarkDefinition.id = generateUuid();

  const referencedEntitiesRequests = {
    [useCasesTableName.value]: {
      Keys: [
        {
          orgId: { S: orgId },
          id: { S: parsedBenchmarkDefinition.useCaseId },
        },
      ],
    },
    [environmentsTableName.value]: {
      Keys: [
        {
          orgId: { S: orgId },
          id: { S: parsedBenchmarkDefinition.environmentId },
        },
      ],
    },
    [productsTableName.value]: {
      Keys: [
        {
          orgId: { S: orgId },
          id: { S: parsedBenchmarkDefinition.productId },
        },
      ],
    },
  };
  console.error({
    event: "Referenced entities requests",
    data: referencedEntitiesRequests,
  });
  try {
    const referencedEntities = await ddbDocClient.send(
      new BatchGetItemCommand({
        RequestItems: referencedEntitiesRequests,
      }),
    );
    const referencedEntitiesResponses = referencedEntities.Responses || {};
    const missingUseCase =
      referencedEntitiesResponses[useCasesTableName.value].length === 0;
    const missingEnvironment =
      referencedEntitiesResponses[environmentsTableName.value].length === 0;
    const missingProduct =
      referencedEntitiesResponses[productsTableName.value].length === 0;
    if (missingUseCase || missingEnvironment || missingProduct) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, {
        message: "Linked entity not found",
      });
    }
    const lastUploadedTimestamp: number = currentTimestamp();
    console.debug({
      event: "Marking benchmark as last updated on",
      data: lastUploadedTimestamp,
    });

    const benchmarkDefinition = BenchmarkDefinition.fromApiModel(
      orgId,
      parsedBenchmarkDefinition,
      lastUploadedTimestamp,
    );
    console.debug({
      event: "Created benchmark definition",
      data: benchmarkDefinition,
    });
    await ddbDocClient.send(
      new PutItemCommand({
        TableName: benchmarkDefinitionsTableName.value,
        Item: benchmarkDefinition.toAttributeValues(),
      }),
    );
    console.debug({ event: "Added benchmarkDefinition" });
    return makeApiGwResponse(StatusCodes.OK, benchmarkDefinition.toApiModel());
  } catch (err) {
    console.log("Failed to add benchmarkDefinition", err.stack);
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

  const benchmarkDefinitionId: string | undefined = event.pathParameters?.id;
  if (benchmarkDefinitionId === undefined) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing id",
    });
  }
  console.debug({
    event: "Extracted benchmarkDefinitionId",
    data: benchmarkDefinitionId,
  });

  const parsedBenchmarkDefinition = JSON.parse(event.body ?? "{}");
  console.debug({
    event: "Parsed benchmarkDefinition",
    data: parsedBenchmarkDefinition,
  });
  if (parsedBenchmarkDefinition.id !== benchmarkDefinitionId) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Id mismatch",
    });
  }

  try {
    const lastUploadedTimestamp: number = currentTimestamp();
    console.debug({
      event: "Marking benchmark as last updated on",
      data: lastUploadedTimestamp,
    });

    const benchmarkDefinition = BenchmarkDefinition.fromApiModel(
      orgId,
      parsedBenchmarkDefinition,
      lastUploadedTimestamp,
    );
    console.debug({
      event: "Created benchmark definition",
      data: benchmarkDefinition,
    });
    await ddbDocClient.send(
      new PutItemCommand({
        ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
        TableName: benchmarkDefinitionsTableName.value,
        Item: benchmarkDefinition.toAttributeValues(),
      }),
    );
    console.debug({ event: "Added benchmarkDefinition" });
    return makeApiGwResponse(StatusCodes.OK, benchmarkDefinition.toApiModel());
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, {
        message: "Not Found",
      });
    } else {
      console.log("Failed to add benchmarkDefinition", err.stack);
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

  const benchmarkDefinitionId: string | undefined = event.pathParameters?.id;
  if (benchmarkDefinitionId === undefined) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing id",
    });
  }
  console.debug({
    event: "Extracted benchmarkDefinitionId",
    data: benchmarkDefinitionId,
  });
  const benchmarkDefinitionKey = new BenchmarkDefinitionKey(
    orgId,
    benchmarkDefinitionId,
  );

  try {
    await ddbDocClient.send(
      new DeleteItemCommand({
        TableName: benchmarkDefinitionsTableName.value,
        Key: benchmarkDefinitionKey.toAttributeValues(),
        ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      }),
    );
    console.debug({ event: "Deleted benchmarkDefinition" });
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, {
        message: "Not Found",
      });
    } else {
      console.log("Failed to delete benchmarkDefinition", err.stack);
      return makeApiGwResponse(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Internal Server Error",
      });
    }
  }

  return makeApiGwResponse(StatusCodes.OK, {});
};
