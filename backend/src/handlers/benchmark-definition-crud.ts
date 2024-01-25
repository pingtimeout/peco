import { extractOrgId, makeApiGwResponse } from "../api-gateway-util";
import { generateUuid } from "../uuid-generator";
import { currentTimestamp } from "../time-source";
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
import { UseCaseKey } from "../model/UseCase";
import { EnvironmentKey } from "../model/Environment";
import { ProductKey } from "../model/Product";
import {
  BenchmarkDefinition,
  BenchmarkDefinitionKey,
} from "../model/BenchmarkDefinition";
import { StatusCodes } from "http-status-codes";

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);
const useCaseTableName = process.env.USE_CASE_TABLE_NAME;
const environmentTableName = process.env.ENVIRONMENT_TABLE_NAME;
const productTableName = process.env.PRODUCT_TABLE_NAME;
const benchmarkDefinitionTableName =
  process.env.BENCHMARK_DEFINITION_TABLE_NAME;

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
        TableName: benchmarkDefinitionTableName,
        FilterExpression: "orgId = :O",
        ExpressionAttributeValues: {
          ":O": { S: orgId },
        },
        ProjectionExpression: "#O, #I, #UI, #EI, #PI, #J, #T, #UN, #EN, #PN, #L",
        ExpressionAttributeNames: {
          "#O": "orgId",
          "#I": "id",
          "#UI": "useCaseId",
          "#EI": "environmentId",
          "#PI": "productId",
          "#J": "jenkinsJobUrl",
          "#T": "tags",
          "#UN": "useCaseName",
          "#EN": "environmentName",
          "#PN": "productName",
          "#L": "lastUpdatedOn",
        },
      })
    );
    const benchmarkDefinitions =
      response.Items?.map((item) =>
        BenchmarkDefinition.fromAttributeValues(item)
      ).filter((u) => u !== undefined) || [];
    console.debug({
      event: "Fetched benchmarkDefinitions",
      data: benchmarkDefinitions,
    });
    return makeApiGwResponse(
      StatusCodes.OK,
      benchmarkDefinitions.map((u) => u.toApiModel())
    );
  } catch (err) {
    console.log("Failed to fetch benchmarkDefinition", err.stack);
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
    benchmarkDefinitionId
  );

  try {
    const response = await ddbDocClient.send(
      new GetItemCommand({
        TableName: benchmarkDefinitionTableName,
        Key: benchmarkDefinitionKey.toAttributeValues(),
      })
    );
    const benchmarkDefinition = BenchmarkDefinition.fromAttributeValues(
      response.Item
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
        benchmarkDefinition.toApiModel()
      );
    }
  } catch (err) {
    console.log("Failed to fetch benchmarkDefinition", err.stack);
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

  const parsedBenchmarkDefinition = JSON.parse(event.body || "{}");
  console.debug({
    event: "Parsed benchmarkDefinition",
    data: parsedBenchmarkDefinition,
  });
  parsedBenchmarkDefinition["id"] = generateUuid();

  try {
    const useCaseId: string = parsedBenchmarkDefinition["useCaseId"];
    if (useCaseId === undefined) {
      return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
        message: "Missing use-case id",
      });
    }
    const useCaseResponse = await ddbDocClient.send(
      new GetItemCommand({
        TableName: useCaseTableName,
        Key: new UseCaseKey(orgId, useCaseId).toAttributeValues(),
        ProjectionExpression: "#N",
        ExpressionAttributeNames: { "#N": "name" },
      })
    );
    if (useCaseResponse.Item === undefined) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, { message: "Not Found" });
    }
    const useCaseName: string = useCaseResponse.Item["name"].S!;

    const environmentId: string = parsedBenchmarkDefinition["environmentId"];
    if (environmentId === undefined) {
      return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
        message: "Missing environment id",
      });
    }
    const environmentResponse = await ddbDocClient.send(
      new GetItemCommand({
        TableName: environmentTableName,
        Key: new EnvironmentKey(orgId, environmentId).toAttributeValues(),
        ProjectionExpression: "#N",
        ExpressionAttributeNames: { "#N": "name" },
      })
    );
    if (environmentResponse.Item === undefined) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, { message: "Not Found" });
    }
    const environmentName: string = environmentResponse.Item["name"].S!;

    const productId: string = parsedBenchmarkDefinition["productId"];
    if (productId === undefined) {
      return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
        message: "Missing product id",
      });
    }
    const productResponse = await ddbDocClient.send(
      new GetItemCommand({
        TableName: productTableName,
        Key: new ProductKey(orgId, productId).toAttributeValues(),
        ProjectionExpression: "#N",
        ExpressionAttributeNames: { "#N": "name" },
      })
    );
    if (productResponse.Item === undefined) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, { message: "Not Found" });
    }
    const productName: string = productResponse.Item["name"].S!;
    const lastUpdatedOn: number = currentTimestamp();
    console.debug({
      event: "Marking benchmark as last updated on",
      data: lastUpdatedOn,
    });

    const benchmarkDefinition = BenchmarkDefinition.fromApiModel(
      orgId,
      parsedBenchmarkDefinition,
      useCaseName,
      environmentName,
      productName,
      lastUpdatedOn
    );
    console.debug({
      event: "Created benchmark definition",
      data: benchmarkDefinition,
    });
    await ddbDocClient.send(
      new PutItemCommand({
        TableName: benchmarkDefinitionTableName,
        Item: benchmarkDefinition.toAttributeValues(),
      })
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

  const parsedBenchmarkDefinition = JSON.parse(event.body || "{}");
  console.debug({
    event: "Parsed benchmarkDefinition",
    data: parsedBenchmarkDefinition,
  });
  if (parsedBenchmarkDefinition["id"] !== benchmarkDefinitionId) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Id mismatch",
    });
  }

  try {
    const useCaseId: string = parsedBenchmarkDefinition["useCaseId"];
    if (useCaseId === undefined) {
      return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
        message: "Missing use-case id",
      });
    }
    const useCaseResponse = await ddbDocClient.send(
      new GetItemCommand({
        TableName: useCaseTableName,
        Key: new UseCaseKey(orgId, useCaseId).toAttributeValues(),
        ProjectionExpression: "#N",
        ExpressionAttributeNames: { "#N": "name" },
      })
    );
    if (useCaseResponse.Item === undefined) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, { message: "Not Found" });
    }
    const useCaseName: string = useCaseResponse.Item["name"].S!;

    const environmentId: string = parsedBenchmarkDefinition["environmentId"];
    if (environmentId === undefined) {
      return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
        message: "Missing environment id",
      });
    }
    const environmentResponse = await ddbDocClient.send(
      new GetItemCommand({
        TableName: environmentTableName,
        Key: new EnvironmentKey(orgId, environmentId).toAttributeValues(),
        ProjectionExpression: "#N",
        ExpressionAttributeNames: { "#N": "name" },
      })
    );
    if (environmentResponse.Item === undefined) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, { message: "Not Found" });
    }
    const environmentName: string = environmentResponse.Item["name"].S!;

    const productId: string = parsedBenchmarkDefinition["productId"];
    if (productId === undefined) {
      return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
        message: "Missing product id",
      });
    }
    const productResponse = await ddbDocClient.send(
      new GetItemCommand({
        TableName: productTableName,
        Key: new ProductKey(orgId, productId).toAttributeValues(),
        ProjectionExpression: "#N",
        ExpressionAttributeNames: { "#N": "name" },
      })
    );
    if (productResponse.Item === undefined) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, { message: "Not Found" });
    }
    const productName: string = productResponse.Item["name"].S!;
    const lastUpdatedOn: number = currentTimestamp();
    console.debug({
      event: "Marking benchmark as last updated on",
      data: lastUpdatedOn,
    });

    const benchmarkDefinition = BenchmarkDefinition.fromApiModel(
      orgId,
      parsedBenchmarkDefinition,
      useCaseName,
      environmentName,
      productName,
      lastUpdatedOn
    );
    console.debug({
      event: "Created benchmark definition",
      data: benchmarkDefinition,
    });
    await ddbDocClient.send(
      new PutItemCommand({
        ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
        TableName: benchmarkDefinitionTableName,
        Item: benchmarkDefinition.toAttributeValues(),
      })
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
    benchmarkDefinitionId
  );

  try {
    await ddbDocClient.send(
      new DeleteItemCommand({
        TableName: benchmarkDefinitionTableName,
        Key: benchmarkDefinitionKey.toAttributeValues(),
        ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      })
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
