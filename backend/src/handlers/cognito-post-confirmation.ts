import {
  APIGatewayClient,
  CreateApiKeyCommand,
  CreateUsagePlanKeyCommand,
  GetUsagePlansCommand,
} from "@aws-sdk/client-api-gateway";
import {
  AdminUpdateUserAttributesCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import UUIDAPIKey from "uuid-apikey";
import { generateUuid } from "../uuid-generator";

const cognitoIdentityServiceProvider = new CognitoIdentityProviderClient({});
const apiGatewayClient = new APIGatewayClient({});

function newOrgId(): string {
  return "org-" + generateUuid();
}

function newApiKey(event: { userPoolId: string; userName: string }): string {
  const uuidApiKeyOptions = {
    noDashes: true,
  };
  const userIdAsApiKey = UUIDAPIKey.toAPIKey(event.userName, uuidApiKeyOptions);
  const shortRandomUuid = generateUuid();
  const apiKey = "api-" + userIdAsApiKey + "-" + shortRandomUuid;
  return apiKey;
}

exports.handler = async (event: {
  userPoolId: any;
  userName: any;
}): Promise<any> => {
  const orgId: string = newOrgId();
  const apiKey: string = newApiKey(event);
  console.debug({
    event: "Assigning ApiKey and orgId to user",
    data: { userName: event.userName, orgId, apiKey },
  });

  try {
    const apiKeyOutputPromise = apiGatewayClient.send(
      new CreateApiKeyCommand({
        name: event.userName,
        value: apiKey,
        enabled: true,
        generateDistinctId: false,
      }),
    );

    const usagePlansOutputPromise = apiGatewayClient.send(
      new GetUsagePlansCommand({}),
    );

    const updateUserAttributesOutputPromise =
      cognitoIdentityServiceProvider.send(
        new AdminUpdateUserAttributesCommand({
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
        }),
      );

    const apiKeyOutput = await apiKeyOutputPromise;
    console.debug({ event: "Created ApiKey with same name as username" });
    const apiKeyId = apiKeyOutput.id;

    const usagePlans = (await usagePlansOutputPromise).items ?? [];
    console.debug({
      event: "Number of usage plans fetched",
      data: usagePlans.length,
    });
    const usagePlanId = usagePlans[0].id; // first usage plan, very fragile

    await apiGatewayClient.send(
      new CreateUsagePlanKeyCommand({
        usagePlanId,
        keyId: apiKeyId,
        keyType: "API_KEY",
      }),
    );
    console.debug({
      event: "Associated ApiKey with UsagePlan",
      data: { apiKeyId, usagePlanId },
    });

    await updateUserAttributesOutputPromise;
    console.debug({ event: "Assigned orgId and apiKey to user" });

    return event;
  } catch (err) {
    console.error({
      event: "Failed to run post-confirmation lambda !",
      data: err.stack,
    });
    return event;
  }
};
