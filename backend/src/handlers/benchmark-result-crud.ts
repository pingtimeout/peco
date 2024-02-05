import {
  BatchWriteItemCommand,
  DynamoDBClient,
  PutItemCommand,
  type PutItemInput,
  UpdateItemCommand,
  type UpdateItemInput,
  type WriteRequest,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import {
  type APIGatewayProxyEvent,
  type APIGatewayProxyResult,
} from "aws-lambda";
import { StatusCodes } from "http-status-codes";

import { extractOrgId, makeApiGwResponse } from "../api-gateway-util";
import {
  benchmarkDefinitionsTableName,
  benchmarkRunsTableName,
  benchmarkValuesTableName,
  monitoredMetricsTableName,
} from "../environment-variables";
import { type ApiBenchmarkResult } from "../model/BenchmarkResult";
import { BenchmarkRun } from "../model/BenchmarkRun";
import { BenchmarkValue } from "../model/BenchmarkValue";
import { currentTimestamp } from "../time-source";

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

export const handleAnyRequest = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const method: string = event.httpMethod;
  console.debug({ event: "Dispatching query", data: { httpMethod: method } });
  if (method === "POST") {
    return await handlePostRequest(event);
  } else {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Unknown path/method combination",
    });
  }
};

export const handlePostRequest = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  const contentType = event.headers["content-type"];
  if (contentType !== "application/json") {
    return makeApiGwResponse(StatusCodes.UNSUPPORTED_MEDIA_TYPE, {
      message: "Unsupported Media Type",
    });
  }

  const orgId: string | undefined = extractOrgId(event);
  if (orgId === undefined) {
    return makeApiGwResponse(StatusCodes.UNAUTHORIZED, {
      message: "Missing orgId",
    });
  }

  if (event.body == null) {
    return makeApiGwResponse(StatusCodes.BAD_REQUEST, {
      message: "Missing body",
    });
  }
  const abr = JSON.parse(event.body) as ApiBenchmarkResult;
  console.debug({
    event: "Parsed result definition",
    data: JSON.stringify(abr),
  });

  const benchmarkRun: BenchmarkRun = BenchmarkRun.fromApiModel(orgId, abr);
  console.debug({
    event: "Computing values from",
    data: JSON.stringify(abr.metrics),
  });
  const benchmarkValues: BenchmarkValue[] = abr.metrics.map((amv) =>
    BenchmarkValue.fromApiModel(orgId, abr, amv),
  );

  const runPutRequest: PutItemInput = {
    TableName: benchmarkRunsTableName.value,
    Item: benchmarkRun.toAttributeValues(),
  };
  console.debug({
    event: "Run put request",
    data: JSON.stringify(runPutRequest),
  });

  const valuesPutRequests = benchmarkValues.map((bv) => ({
    PutRequest: {
      Item: bv.toAttributeValues(),
    },
  }));
  console.debug({
    event: "Values put requests",
    data: JSON.stringify(valuesPutRequests),
  });

  const metricsUpdateRequest: UpdateItemInput = {
    TableName: monitoredMetricsTableName.value,
    Key: {
      orgId: { S: orgId },
      benchmarkId: { S: abr.benchmarkId },
    },
    UpdateExpression: "ADD #metricDefinitionIds :metricDefinitionIds",
    ExpressionAttributeNames: { "#metricDefinitionIds": "metricDefinitionIds" },
    ExpressionAttributeValues: {
      ":metricDefinitionIds": {
        SS: abr.metrics.map((metric: any) => metric.metricDefinitionId),
      },
    },
  };
  console.debug({
    event: "Monitored metrics update request",
    data: JSON.stringify(metricsUpdateRequest),
  });

  const benchmarkDefinitionUpdateRequest: UpdateItemInput = {
    TableName: benchmarkDefinitionsTableName.value,
    Key: {
      orgId: { S: orgId },
      id: { S: abr.benchmarkId },
    },
    UpdateExpression: "SET #L = :l",
    ExpressionAttributeNames: { "#L": "lastUploadedTimestamp" },
    ExpressionAttributeValues: {
      ":l": { N: "" + currentTimestamp() },
    },
  };
  console.debug({
    event: "Benchmark definitions update request",
    data: JSON.stringify(benchmarkDefinitionUpdateRequest),
  });

  try {
    const runPutPromise = ddbDocClient.send(new PutItemCommand(runPutRequest));
    const valuesPutPromise = ddbDocClient.send(
      new BatchWriteItemCommand({
        RequestItems: {
          [benchmarkValuesTableName.value]: valuesPutRequests,
        },
      }),
    );
    const metricsUpdatePromise = ddbDocClient.send(
      new UpdateItemCommand(metricsUpdateRequest),
    );
    const benchmarkDefinitionsUpdatePromise = ddbDocClient.send(
      new UpdateItemCommand(benchmarkDefinitionUpdateRequest),
    );

    await runPutPromise;
    await valuesPutPromise;
    await metricsUpdatePromise;
    await benchmarkDefinitionsUpdatePromise;

    return makeApiGwResponse(StatusCodes.OK, {});
  } catch (err) {
    console.log("Failed to add benchmark values", err.stack);
    return makeApiGwResponse(StatusCodes.INTERNAL_SERVER_ERROR, {
      message: "Internal Server Error",
    });
  }
};
