import { v4 as uuidv4 } from "uuid";
import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { PostConfirmationTriggerHandler } from "@types/aws-lambda";
import {
  APIGatewayClient,
  CreateUsagePlanKeyCommand,
  CreateApiKeyCommand,
  GetUsagePlansCommand,
  GetUsagePlanCommandOutput,
} from "@aws-sdk/client-api-gateway";
import UUIDAPIKey from "uuid-apikey";

const cognitoIdentityServiceProvider = new CognitoIdentityProviderClient({});
const apiGatewayClient = new APIGatewayClient({});

function newOrgId(): string {
  return "org-" + uuidv4();
}

function newApiKey(event: { userPoolId: any; userName: any }): string {
  const uuidApiKeyOptions = {
    noDashes: true,
  };
  const userIdAsApiKey = UUIDAPIKey.toAPIKey(event.userName, uuidApiKeyOptions);
  const randomUuidAsApiKey = UUIDAPIKey.create(uuidApiKeyOptions).apiKey;
  const apiKey = "apikey-" + userIdAsApiKey + "-" + randomUuidAsApiKey;
  return apiKey;
}

/**
 * @type {import('@types/aws-lambda').PostConfirmationTriggerHandler}
 */
exports.handler = async (event: {
  userPoolId: any;
  userName: any;
}): Promise<any> => {
  const usagePlansOutputPromise = apiGatewayClient.send(
    new GetUsagePlansCommand({})
  );

  const orgId = newOrgId();
  const apiKey = newApiKey(event);
  const updateUserAttributesParams = {
    UserPoolId: event.userPoolId,
    Username: event.userName,
    UserAttributes: [
      {
        Name: "custom:orgId",
        Value: orgId,
      },
      {
        Name: "custom:apiKey",
        Value: apiKey,
      },
    ],
  };
  const createApiKeyParams = {
    name: event.userName,
    value: apiKey,
    enabled: true,
  };
  await cognitoIdentityServiceProvider.send(
    new AdminUpdateUserAttributesCommand(updateUserAttributesParams)
  );
  const apiKeyOutput = await apiGatewayClient.send(
    new CreateApiKeyCommand(createApiKeyParams)
  );
  const usagePlansOutput = await usagePlansOutputPromise;

  const firstUsagePlanId = usagePlansOutput.items![0].id!;
  const createUsagePlanKeyParams = {
    usagePlanId: firstUsagePlanId,
    keyId: apiKeyOutput.id!,
    keyType: "API_KEY",
  };
  await apiGatewayClient.send(
    new CreateUsagePlanKeyCommand(createUsagePlanKeyParams)
  );

  return event;
};
