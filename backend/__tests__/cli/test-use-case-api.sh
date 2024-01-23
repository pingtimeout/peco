#!/usr/bin/env bash

handle_error() {
    echo
    echo -e "\033[1m\033[41mAN ERROR OCCURRED ON LINE $1\033[0m" >&2
    exit 1
}

trap 'handle_error $LINENO' ERR

if [ -z "$API_KEY" ]
then
  echo "Error: missing API_KEY" >&2
  exit 1
fi

if [ -z "$ID_TOKEN" ]
then
  echo "Error: missing ID_TOKEN" >&2
  exit 1
fi

if [ -z "$BASE_URL" ]
then
  echo "Error: missing BASE_URL" >&2
  exit 1
fi

set -eu

random_string=${2:-$(uuidgen | tr '[:upper:]' '[:lower:]' | tr -d - | head -c 8)}

use_case_id=$(
  curl \
    --silent \
    --fail \
    -H "X-API-KEY: $API_KEY" \
    -H "Authorization: $ID_TOKEN" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"id\": \"$random_string-id\", \"name\": \"$random_string-name\", \"description\": \"$random_string-description\", \"tags\": [{\"name\": \"$random_string-tag-name\", \"value\": \"$random_string-tag-value\"}]}" \
    $BASE_URL/use-cases/ \
  | jq -r .id
)
echo -e "\033[32mPASS:\033[0m Created use-case $use_case_id"

curl \
  --silent \
  --fail \
  -H "X-API-KEY: $API_KEY" \
  -H "Authorization: $ID_TOKEN" \
  -X GET \
  $BASE_URL/use-cases/$use_case_id \
| jq "[. | select(.id == \"$use_case_id\" and .name == \"$random_string-name\" and .description == \"$random_string-description\" and .tags[0].name == \"$random_string-tag-name\" and .tags[0].value == \"$random_string-tag-value\")] | length" \
| grep -wq 1
echo -e "\033[32mPASS:\033[0m Fetched use-case"

curl \
  --silent \
  --fail \
  -H "X-API-KEY: $API_KEY" \
  -H "Authorization: $ID_TOKEN" \
  -X PUT \
  -H "Content-Type: application/json" \
  -d "{\"id\": \"$use_case_id\", \"name\": \"$random_string-updated-name\", \"description\": \"$random_string-updated-description\", \"tags\": [{\"name\": \"$random_string-updated-tag-name\", \"value\": \"$random_string-updated-tag-value\"}]}" \
  $BASE_URL/use-cases/$use_case_id \
  >/dev/null
echo -e "\033[32mPASS:\033[0m Updated use-case"

curl \
  --silent \
  --fail \
  -H "X-API-KEY: $API_KEY" \
  -H "Authorization: $ID_TOKEN" \
  -X GET \
  $BASE_URL/use-cases/$use_case_id \
| jq "[. | select(.id == \"$use_case_id\" and .name == \"$random_string-updated-name\" and .description == \"$random_string-updated-description\" and .tags[0].name == \"$random_string-updated-tag-name\" and .tags[0].value == \"$random_string-updated-tag-value\")] | length" \
| grep -wq 1
echo -e "\033[32mPASS:\033[0m Fecthed updated use-case"

curl \
  --silent \
  --fail \
  -H "X-API-KEY: $API_KEY" \
  -H "Authorization: $ID_TOKEN" \
  -X DELETE \
  $BASE_URL/use-cases/$use_case_id \
| >/dev/null
echo -e "\033[32mPASS:\033[0m Deleted use-case"
