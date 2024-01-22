#!/usr/bin/env bash

if [ -z "$USER_POOL_ID" ]
then
  echo "Error: missing USER_POOL_ID" >&2
  exit 1
fi

if [ -z "$CLIENT_ID" ]
then
  echo "Error: missing CLIENT_ID" >&2
  exit 1
fi

if [ -z "$POST_CONFIRMATION_LAMBDA_NAME" ]
then
  echo "Error: missing POST_CONFIRMATION_LAMBDA_NAME" >&2
  exit 1
fi

set -eu

USERNAME=$(
  aws --profile performance cognito-idp admin-create-user \
    --user-pool-id $USER_POOL_ID \
    --username pierre.laporte@dremio.com \
    --temporary-password pierre.laporte@dremio.com \
    --message-action SUPPRESS \
  | jq -r .User.Username
)

aws --profile performance cognito-idp admin-set-user-password \
  --user-pool-id $USER_POOL_ID \
  --username pierre.laporte@dremio.com \
  --password pierre.laporte@dremio.com \
  --permanent

echo "{\"userPoolId\": \"$USER_POOL_ID\", \"userName\": \"$USERNAME\"}" >/tmp/payload.json
aws --profile performance lambda invoke \
  --function-name $POST_CONFIRMATION_LAMBDA_NAME \
  --payload file:///tmp/payload.json \
  /tmp/outputfile.txt \
  --cli-binary-format raw-in-base64-out
