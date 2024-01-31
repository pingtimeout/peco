import { extractOrgId, makeApiGwResponse } from "../api-gateway-util";
import { generateUuid } from "../uuid-generator";
import { currentTimestamp } from "../time-source";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  DynamoDBClient,
  UpdateItemCommand,
  UpdateItemInput,
  PutItemInput,
  PutItemCommand,
  WriteRequest,
  BatchWriteItemCommand,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { StatusCodes } from "http-status-codes";
import {
  benchmarkDefinitionsTableName,
  benchmarkRunsTableName,
  benchmarkValuesTableName,
  monitoredMetricsTableName,
} from "../environment-variables";

const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

export const handleAnyRequest = async (
  event: APIGatewayProxyEvent
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
  event: APIGatewayProxyEvent
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

  const parsedRun = JSON.parse(event.body || "{}");
  console.debug({
    event: "Parsed run definition",
    data: JSON.stringify(parsedRun),
  });

  const benchmarkId = parsedRun["benchmarkId"];
  const executedOn = parsedRun["executedOn"];
  const jenkinsJobNumber = isNaN(parsedRun["jenkinsJobNumber"])
    ? 0
    : Number(parsedRun["jenkinsJobNumber"]);

  const runPutRequest: PutItemInput = {
    TableName: benchmarkRunsTableName,
    Item: {
      fullRunId: { S: orgId + "#" + benchmarkId },
      executedOn: { N: executedOn.toString() },
      jenkinsJobNumber: { N: jenkinsJobNumber.toString() },
    },
  };
  console.debug({
    event: "Run put request",
    data: JSON.stringify(runPutRequest),
  });

  const valuesPutRequests: WriteRequest[] = parsedRun["metrics"].map(
    (metric: any) => ({
      PutRequest: {
        Item: {
          fullValueId: {
            S: orgId + "#" + benchmarkId + "#" + metric["metricDefinitionId"],
          },
          executedOn: { N: executedOn.toString() },
          value: { N: metric["value"].toString() },
        },
      },
    })
  );
  console.debug({
    event: "Values put requests",
    data: JSON.stringify(valuesPutRequests),
  });

  const metricsUpdateRequest: UpdateItemInput = {
    TableName: monitoredMetricsTableName,
    Key: {
      orgId: { S: orgId },
      benchmarkId: { S: benchmarkId },
    },
    UpdateExpression: "ADD #metricDefinitionIds :metricDefinitionIds",
    ExpressionAttributeNames: { "#metricDefinitionIds": "metricDefinitionIds" },
    ExpressionAttributeValues: {
      ":metricDefinitionIds": {
        SS: parsedRun["metrics"].map(
          (metric: any) => metric["metricDefinitionId"]
        ),
      },
    },
  };
  console.debug({
    event: "Monitored metrics update request",
    data: JSON.stringify(metricsUpdateRequest),
  });

  const benchmarkDefinitionUpdateRequest: UpdateItemInput = {
    TableName: benchmarkDefinitionsTableName,
    Key: {
      orgId: { S: orgId },
      id: { S: benchmarkId },
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
          [benchmarkValuesTableName]: valuesPutRequests,
        },
      })
    );
    const metricsUpdatePromise = ddbDocClient.send(
      new UpdateItemCommand(metricsUpdateRequest)
    );
    const benchmarkDefinitionsUpdatePromise = ddbDocClient.send(
      new UpdateItemCommand(benchmarkDefinitionUpdateRequest)
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
