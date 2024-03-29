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
import { productsTableName } from "../environment-variables";
import { type ApiProduct, Product, ProductKey } from "../model/Product";
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
        TableName: productsTableName.value,
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
    const products =
      response.Items?.map((item) => Product.fromAttributeValues(item)).filter(
        (u) => u !== undefined,
      ) ?? [];
    console.debug({
      event: "Number of products fetched:",
      data: products.length,
    });
    return makeApiGwResponse(
      StatusCodes.OK,
      products.map((u) => u.toApiModel()),
    );
  } catch (err) {
    console.error({ event: "Failed to fetch products", data: err.stack });
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

  const productId: string | undefined = event.pathParameters?.id;
  if (productId === undefined) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing id",
    });
  }
  console.debug({ event: "Extracted productId", data: productId });
  const productKey = new ProductKey(orgId, productId);

  try {
    const response = await ddbDocClient.send(
      new GetItemCommand({
        TableName: productsTableName.value,
        Key: productKey.toAttributeValues(),
      }),
    );
    const product = Product.fromAttributeValues(response.Item);
    console.debug({ event: "Fetched product", data: product });
    if (product === undefined) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, { message: "Not Found" });
    } else {
      return makeApiGwResponse(StatusCodes.OK, product.toApiModel());
    }
  } catch (err) {
    console.error({ event: "Failed to fetch product", data: err.stack });
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

  const parsedProduct = JSON.parse(event.body ?? "{}");
  parsedProduct.id = "prd-" + generateUuid();
  const product = Product.fromApiModel(orgId, parsedProduct as ApiProduct);
  console.debug({ event: "Parsed product", data: product });

  try {
    await ddbDocClient.send(
      new PutItemCommand({
        TableName: productsTableName.value,
        Item: product.toAttributeValues(),
      }),
    );
    console.debug({ event: "Added product" });
    return makeApiGwResponse(StatusCodes.OK, parsedProduct);
  } catch (err) {
    console.error({ event: "Failed to add product", data: err.stack });
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

  const productId: string | undefined = event.pathParameters?.id;
  if (productId === undefined) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing id",
    });
  }
  console.debug({ event: "Extracted productId", data: productId });

  const parsedProduct = JSON.parse(event.body ?? "{}");
  if (parsedProduct.id !== productId) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Id mismatch",
    });
  }
  const product = Product.fromApiModel(orgId, parsedProduct as ApiProduct);
  console.debug({ event: "Parsed product", data: product });

  try {
    await ddbDocClient.send(
      new PutItemCommand({
        TableName: productsTableName.value,
        Item: product.toAttributeValues(),
        ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      }),
    );
    console.debug({ event: "Updated product" });
    return makeApiGwResponse(StatusCodes.OK, parsedProduct);
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, {
        message: "Not Found",
      });
    } else {
      console.error({ event: "Failed to update product", data: err.stack });
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

  const productId: string | undefined = event.pathParameters?.id;
  if (productId === undefined) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing id",
    });
  }
  console.debug({ event: "Extracted productId", data: productId });
  const productKey = new ProductKey(orgId, productId);

  try {
    await ddbDocClient.send(
      new DeleteItemCommand({
        TableName: productsTableName.value,
        Key: productKey.toAttributeValues(),
        ConditionExpression: "attribute_exists(orgId) AND attribute_exists(id)",
      }),
    );
    console.debug({ event: "Deleted product" });
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      return makeApiGwResponse(StatusCodes.NOT_FOUND, {
        message: "Not Found",
      });
    } else {
      console.error({ event: "Failed to delete product", data: err.stack });
      return makeApiGwResponse(StatusCodes.INTERNAL_SERVER_ERROR, {
        message: "Internal Server Error",
      });
    }
  }

  return makeApiGwResponse(StatusCodes.OK, {});
};
