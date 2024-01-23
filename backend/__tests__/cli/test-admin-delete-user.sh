#!/usr/bin/env bash

if [ -z "$USER_POOL_ID" ]
then
  echo "Error: missing USER_POOL_ID" >&2
  exit 1
fi

if [ -z "$1" ]
then
  echo "Usage: $0 EMAIL_ADDRESS" >&2
  exit 1
fi

set -eu

EMAIL_ADDRESS=$1

echo Deleting account for $EMAIL_ADDRESS

USERNAME=$(
  aws --profile performance cognito-idp admin-get-user \
    --user-pool-id $USER_POOL_ID \
    --username "$EMAIL_ADDRESS" \
  | jq -r '.Username'
)

API_KEY_ID=$(
  aws --profile performance apigateway get-api-keys \
    --name-query $USERNAME \
  | jq -r '.items[0].id'
)

aws --profile performance apigateway delete-api-key \
  --api-key "$API_KEY_ID"

aws --profile performance cognito-idp admin-delete-user \
  --user-pool-id $USER_POOL_ID \
  --username "$EMAIL_ADDRESS"
