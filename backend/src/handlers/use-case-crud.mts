// import { v4 as uuidv4 } from 'uuid';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

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
  console.log("Received event: " + JSON.stringify(event));
  const orgId = event.requestContext.authorizer?.claims["custom:orgId"];
  console.log("User orgId is: " + orgId);
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
