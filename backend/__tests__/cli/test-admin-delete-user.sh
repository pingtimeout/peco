#!/usr/bin/env bash

handle_error() {
    echo
    echo -e "\033[1m\033[41mAN ERROR OCCURRED ON LINE $1\033[0m" >&2
    exit 1
}

trap 'handle_error $LINENO' ERR

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

echo -n "Fetching account metadata for $EMAIL_ADDRESS..."
COGNITO_USER_PAYLOAD=$(
  aws --profile performance cognito-idp admin-get-user \
    --user-pool-id $USER_POOL_ID \
    --username "$EMAIL_ADDRESS"
)
COGNITO_USERNAME=$(echo $COGNITO_USER_PAYLOAD | jq -r '.Username')
ORG_ID=$(echo $COGNITO_USER_PAYLOAD | jq -r '.UserAttributes[] | select(.Name == "custom:orgId").Value')
echo -e "\033[32mDone\033[0m"

echo -n "Fetching benchmark values full ids..."
FULL_VALUE_IDS=$(
  aws --profile performance dynamodb scan \
    --table-name MonitoredMetrics \
    --filter-expression "orgId = :o" \
    --projection-expression "#O, #B, #M" \
    --expression-attribute-names '{"#O": "orgId", "#B": "benchmarkId", "#M": "metricDefinitionIds"}' \
    --expression-attribute-values "{\":o\": {\"S\": \"$ORG_ID\"}}" \
  | jq -r '.Items[] | .orgId.S + "#" + .benchmarkId.S + "#" + (.metricDefinitionIds.SS[])'
)
echo -e "\033[32mDone\033[0m"
while IFS= read -r fullValueId
do
  echo -n "Deleting all values of $fullValueId..."
  delete_requests=$(
    aws --profile performance dynamodb scan \
      --table-name BenchmarkValues \
      --filter-expression "fullValueId = :i" \
      --projection-expression "#V, #T" \
      --expression-attribute-names '{"#V": "fullValueId", "#T": "executedOn"}' \
      --expression-attribute-values "{\":i\": {\"S\": \"$fullValueId\"}}" \
      | jq -cr '{BenchmarkValues: [.Items[] | {DeleteRequest: {Key: .}}]}'
  )
  if [[ "$delete_requests" == '{"BenchmarkValues":[]}' ]]
  then
    echo -e "\033[32mNothing to do\033[0m"
  else
    aws --profile performance dynamodb batch-write-item \
      --request-items "$delete_requests"
    echo -e "\033[32mDone\033[0m"
  fi
done <<< "$FULL_VALUE_IDS"

echo -n "Fetching benchmark runs full ids..."
FULL_RUN_IDS=$(
  aws --profile performance dynamodb scan \
    --table-name MonitoredMetrics \
    --filter-expression "orgId = :o" \
    --projection-expression "#O, #B" \
    --expression-attribute-names '{"#O": "orgId", "#B": "benchmarkId"}' \
    --expression-attribute-values "{\":o\": {\"S\": \"$ORG_ID\"}}" \
  | jq -r '.Items[] | .orgId.S + "#" + .benchmarkId.S'
)
echo -e "\033[32mDone\033[0m"
while IFS= read -r fullRunId
do
  echo -n "Deleting all runs of $fullRunId..."
  delete_requests=$(
    aws --profile performance dynamodb scan \
      --table-name BenchmarkRuns \
      --filter-expression "fullRunId = :i" \
      --projection-expression "#V, #T" \
      --expression-attribute-names '{"#V": "fullRunId", "#T": "executedOn"}' \
      --expression-attribute-values "{\":i\": {\"S\": \"$fullRunId\"}}" \
      | jq -cr '{BenchmarkRuns: [.Items[] | {DeleteRequest: {Key: .}}]}'
  )
  if [[ "$delete_requests" == '{"BenchmarkRuns":[]}' ]]
  then
    echo -e "\033[32mNothing to do\033[0m"
  else
    aws --profile performance dynamodb batch-write-item \
      --request-items "$delete_requests"
    echo -e "\033[32mDone\033[0m"
  fi
done <<< "$FULL_RUN_IDS"

echo -n "Deleting all monitored metrics of $ORG_ID..."
delete_requests=$(
  aws --profile performance dynamodb scan \
    --table-name MonitoredMetrics \
    --filter-expression "orgId = :o" \
    --projection-expression "#O, #B" \
    --expression-attribute-names '{"#O": "orgId", "#B": "benchmarkId"}' \
    --expression-attribute-values "{\":o\": {\"S\": \"$ORG_ID\"}}" \
    | jq -cr '{MonitoredMetrics: [.Items[] | {DeleteRequest: {Key: .}}]}'
)
if [[ "$delete_requests" == '{"MonitoredMetrics":[]}' ]]
then
  echo -e "\033[32mNothing to do\033[0m"
else
  aws --profile performance dynamodb batch-write-item \
    --request-items "$delete_requests"
  echo -e "\033[32mDone\033[0m"
fi

echo -n "Deleting all benchmark definitions of $ORG_ID..."
delete_requests=$(
  aws --profile performance dynamodb scan \
    --table-name BenchmarkDefinitions \
    --filter-expression "orgId = :o" \
    --projection-expression "#O, #I" \
    --expression-attribute-names '{"#O": "orgId", "#I": "id"}' \
    --expression-attribute-values "{\":o\": {\"S\": \"$ORG_ID\"}}" \
    | jq -cr '{BenchmarkDefinitions: [.Items[] | {DeleteRequest: {Key: .}}]}'
)
if [[ "$delete_requests" == '{"BenchmarkDefinitions":[]}' ]]
then
  echo -e "\033[32mNothing to do\033[0m"
else
  aws --profile performance dynamodb batch-write-item \
    --request-items "$delete_requests"
  echo -e "\033[32mDone\033[0m"
fi

echo -n "Deleting all metric definitions of $ORG_ID..."
delete_requests=$(
  aws --profile performance dynamodb scan \
    --table-name MetricDefinitions \
    --filter-expression "orgId = :o" \
    --projection-expression "#O, #I" \
    --expression-attribute-names '{"#O": "orgId", "#I": "id"}' \
    --expression-attribute-values "{\":o\": {\"S\": \"$ORG_ID\"}}" \
    | jq -cr '{MetricDefinitions: [.Items[] | {DeleteRequest: {Key: .}}]}'
)
if [[ "$delete_requests" == '{"MetricDefinitions":[]}' ]]
then
  echo -e "\033[32mNothing to do\033[0m"
else
  aws --profile performance dynamodb batch-write-item \
    --request-items "$delete_requests"
  echo -e "\033[32mDone\033[0m"
fi

echo -n "Deleting all use cases of $ORG_ID..."
delete_requests=$(
  aws --profile performance dynamodb scan \
    --table-name UseCases \
    --filter-expression "orgId = :o" \
    --projection-expression "#O, #I" \
    --expression-attribute-names '{"#O": "orgId", "#I": "id"}' \
    --expression-attribute-values "{\":o\": {\"S\": \"$ORG_ID\"}}" \
    | jq -cr '{UseCases: [.Items[] | {DeleteRequest: {Key: .}}]}'
)
if [[ "$delete_requests" == '{"UseCases":[]}' ]]
then
  echo -e "\033[32mNothing to do\033[0m"
else
  aws --profile performance dynamodb batch-write-item \
    --request-items "$delete_requests" \
  echo
fi

echo -n "Deleting all environments of $ORG_ID..."
delete_requests=$(
  aws --profile performance dynamodb scan \
    --table-name Environments \
    --filter-expression "orgId = :o" \
    --projection-expression "#O, #I" \
    --expression-attribute-names '{"#O": "orgId", "#I": "id"}' \
    --expression-attribute-values "{\":o\": {\"S\": \"$ORG_ID\"}}" \
    | jq -cr '{Environments: [.Items[] | {DeleteRequest: {Key: .}}]}'
)
if [[ "$delete_requests" == '{"Environments":[]}' ]]
then
  echo -e "\033[32mNothing to do\033[0m"
else
  aws --profile performance dynamodb batch-write-item \
    --request-items "$delete_requests"
  echo -e "\033[32mDone\033[0m"
fi

echo -n "Deleting all products of $ORG_ID..."
delete_requests=$(
  aws --profile performance dynamodb scan \
    --table-name Products \
    --filter-expression "orgId = :o" \
    --projection-expression "#O, #I" \
    --expression-attribute-names '{"#O": "orgId", "#I": "id"}' \
    --expression-attribute-values "{\":o\": {\"S\": \"$ORG_ID\"}}" \
    | jq -cr '{Products: [.Items[] | {DeleteRequest: {Key: .}}]}'
)
if [[ "$delete_requests" == '{"Products":[]}' ]]
then
  echo -e "\033[32mNothing to do\033[0m"
else
  aws --profile performance dynamodb batch-write-item \
    --request-items "$delete_requests"
  echo -e "\033[32mDone\033[0m"
fi

echo -n "Fetching account API Key ID..."
API_KEY_ID=$(
  aws --profile performance apigateway get-api-keys \
    --name-query $COGNITO_USERNAME \
  | jq -r '.items[0].id'
)
echo -e "\033[32mDone\033[0m"

echo -n "Deleting API Key..."
aws --profile performance apigateway delete-api-key \
  --api-key "$API_KEY_ID"
echo -e "\033[32mDone\033[0m"

echo -n "Deleting account..."
aws --profile performance cognito-idp admin-delete-user \
  --user-pool-id $USER_POOL_ID \
  --username "$EMAIL_ADDRESS"
echo -e "\033[32mDone\033[0m"

echo -e "\033[32mFinished\033[0m"
