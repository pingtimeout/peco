// import { v4 as uuidv4 } from 'uuid';
// import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// const cognitoIdentityServiceProvider = new CognitoIdentityProviderClient({});

export const handle_get_request = async (event : APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> => {
  console.log("Cognito user pool ID: " + JSON.stringify(process.env.COGNITO_USER_POOL_ID));
  console.log("Received event: " + JSON.stringify(event));
  return {
    statusCode: 200,
    body: '{"status": "Success during GET"}',
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  };
};

export const handle_post_request = async (event : APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> => {
  console.log("Cognito user pool ID: " + JSON.stringify(process.env.COGNITO_USER_POOL_ID));
  console.log("Received event: " + JSON.stringify(event));
  return {
    statusCode: 200,
    body: '{"status": "Success during POST"}',
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  };
};

export const handle_put_request = async (event : APIGatewayProxyEvent) : Promise<APIGatewayProxyResult> => {
  console.log("Cognito user pool ID: " + JSON.stringify(process.env.COGNITO_USER_POOL_ID));
  console.log("Received event: " + JSON.stringify(event));
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
