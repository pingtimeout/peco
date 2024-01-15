import { v4 as uuidv4 } from 'uuid';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);
const useCaseTableName = process.env.USE_CASE_TABLE_NAME;

export const handle_get_request = async (event : APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> => {
  console.log("Received event: " + JSON.stringify(event));
  const orgId = event.requestContext.authorizer?.claims["custom:orgId"];
  console.log("User orgId is: " + orgId);
  return {
    statusCode: 200,
    body: '{"status": "Success during GET"}',
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  };
};

export const handle_post_request = async (event : APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> => {
  const contentType = event.headers["content-type"];
  if(contentType !== "application/json") {
    return {
      statusCode: 415,
      body: '{"message": "Unsupported Media Type"}',
    }
  }
  const orgId = event.requestContext.authorizer?.claims["custom:orgId"];
  const parsedUseCase = JSON.parse(event.body || "{}");
  console.log("Parsed use case is: " + JSON.stringify(parsedUseCase));
  parsedUseCase["orgId"] = orgId;
  parsedUseCase["id"] = uuidv4();
  console.log("Storable use case is: " + JSON.stringify(parsedUseCase));
  return {
    statusCode: 200,
    body: '{"status": "Success during POST"}',
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  };
};

export const handle_put_request = async (event : APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> => {
  console.log("Received event: " + JSON.stringify(event));
  const orgId = event.requestContext.authorizer?.claims["custom:orgId"];
  console.log("User orgId is: " + orgId);
  return {
    statusCode: 200,
    body: '{"status": "Success during PUT"}',
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  };
};

// {orgId, id}
// name, description, tags (key, value)
