#!/usr/bin/env bash

set -eu

handle_error() {
    echo
    echo -e "\033[1m\033[41mAN ERROR OCCURRED ON LINE $1\033[0m" >&2
    exit 1
}

trap 'handle_error $LINENO' ERR

echo "Use cases:"
aws --profile performance dynamodb scan --table-name UseCases | jq .Items -c | underscore pretty
echo

echo "Environments:"
aws --profile performance dynamodb scan --table-name Environments | jq .Items -c | underscore pretty
echo

echo "Products:"
aws --profile performance dynamodb scan --table-name Products | jq .Items -c | underscore pretty
echo

echo "Metric definitions:"
aws --profile performance dynamodb scan --table-name MetricDefinitions | jq .Items -c | underscore pretty
echo

echo "Benchmark definitions:"
aws --profile performance dynamodb scan --table-name BenchmarkDefinitions | jq .Items -c | underscore pretty
echo

echo "Monitored metrics:"
aws --profile performance dynamodb scan --table-name MonitoredMetrics | jq .Items -c | underscore pretty
echo

echo "Benchmark runs:"
aws --profile performance dynamodb scan --table-name BenchmarkRuns | jq .Items -c | underscore pretty
echo

echo "Benchmark values:"
aws --profile performance dynamodb scan --table-name BenchmarkValues | jq .Items -c | underscore pretty
echo
