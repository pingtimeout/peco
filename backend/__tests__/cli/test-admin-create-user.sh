#!/usr/bin/env bash

if [ -z "$USER_POOL_ID" ]
then
  echo "Error: missing USER_POOL_ID" >&2
  exit 1
fi

if [ -z "$POST_CONFIRMATION_LAMBDA_NAME" ]
then
  echo "Error: missing POST_CONFIRMATION_LAMBDA_NAME" >&2
  exit 1
fi

if [ -z "$1" ]
then
  echo "Usage: $0 EMAIL_ADDRESS [PASSWORD]" >&2
  exit 1
fi

set -eu

EMAIL_ADDRESS=$1
PASSWORD=${2:-$(uuidgen | tr '[:upper:]' '[:lower:]' | tr -d - | head -c 8)}

USERNAME=$(
  aws --profile performance cognito-idp admin-create-user \
    --user-pool-id $USER_POOL_ID \
    --username "$EMAIL_ADDRESS" \
    --temporary-password "$PASSWORD" \
    --message-action SUPPRESS \
  | jq -r .User.Username
)
echo -e "\033[32mPASS:\033[0m Created account for $EMAIL_ADDRESS (sub: $USERNAME) with password: $PASSWORD"

aws --profile performance cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username "$EMAIL_ADDRESS" \
  --password "$PASSWORD" \
  --permanent
echo -e "\033[32mPASS:\033[0m Confirmed account"

echo "{\"userPoolId\": \"$USER_POOL_ID\", \"userName\": \"$USERNAME\"}" >/tmp/payload.json
aws --profile performance lambda invoke \
  --function-name $POST_CONFIRMATION_LAMBDA_NAME \
  --payload file:///tmp/payload.json \
  /tmp/outputfile.txt \
  --cli-binary-format raw-in-base64-out \
  >/dev/null
echo -e "\033[32mPASS:\033[0m Associated orgId and created API key"

API_KEY=$(
  aws --profile performance apigateway get-api-keys \
    --name-query "$USERNAME" \
    --include-value \
  | jq -r '.items[0].value'
)
echo -e "\033[32mPASS:\033[0m Fetched API key"
echo "export API_KEY=$API_KEY"
