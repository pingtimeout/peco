import { handleAnyRequest } from "../../../src/handlers/benchmark-run-crud";
import {
  test_rejection_if_not_json_content_type,
  test_rejection_if_missing_orgId,
  test_rejection_if_missing_authorizer,
} from "../handler-util";
import {
  PutItemCommand,
  UpdateItemCommand,
  BatchWriteItemCommand,
  DeleteItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import "aws-sdk-client-mock-jest";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

jest.mock("../../../src/time-source", () => {
  const originalModule = jest.requireActual("../../../src/time-source");
  return {
    __esModule: true,
    ...originalModule,
    currentTimestamp: jest.fn(() => 1706201101677), // 2024-01-25T16:45:01.677Z
  };
});

jest.mock("../../../src/environment-variables", () => {
  return {
    __esModule: true,
    benchmarkDefinitionsTableName: "MockBenchmarkDefinitionsTable",
    benchmarkRunsTableName: "MockBenchmarkRunsTable",
    benchmarkValuesTableName: "MockBenchmarkValuesTable",
    monitoredMetricsTableName: "MockMonitoredMetricsTable",
  };
});

describe("Test handlePostRequest", () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    ddbMock.reset();
  });

  it("should reject queries using other than JSON content type", async () => {
    test_rejection_if_not_json_content_type(
      ddbMock,
      handleAnyRequest,
      undefined,
      "POST",
    );
  });

  it("should reject queries with no authorizer", async () => {
    test_rejection_if_missing_authorizer(
      ddbMock,
      handleAnyRequest,
      undefined,
      "POST",
    );
  });

  it("should reject queries with no orgId in claims", async () => {
    test_rejection_if_missing_orgId(
      ddbMock,
      handleAnyRequest,
      undefined,
      "POST",
    );
  });

  it("should store benchmark run metadata", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      httpMethod: "POST",
      // @ts-ignore
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      body: JSON.stringify({
        benchmarkId: "the-benchmark-id",
        executedOn: 123456789,
        metrics: [
          { metricDefinitionId: "mid-1", value: 111 },
          { metricDefinitionId: "mid-2", value: 222 },
          { metricDefinitionId: "mid-3", value: 333 },
          { metricDefinitionId: "mid-4", value: 444 },
          { metricDefinitionId: "mid-5", value: 555 },
        ],
      }),
    };

    const result = await handleAnyRequest(event as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(4);
    expect(ddbMock).toHaveReceivedCommandWith(UpdateItemCommand, {
      TableName: "MockBenchmarkDefinitionsTable",
      Key: {
        orgId: { S: "the-org-id" },
        id: { S: "the-benchmark-id" },
      },
      UpdateExpression: "SET #L = :l",
      ExpressionAttributeNames: {
        "#L": "lastUploadedTimestamp",
      },
      ExpressionAttributeValues: {
        ":l": { N: "1706201101677" },
      },
    });
    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: "{}",
    });
  });

  it("should store benchmark run metadata", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      httpMethod: "POST",
      // @ts-ignore
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      body: JSON.stringify({
        benchmarkId: "the-benchmark-id",
        executedOn: 123456789,
        metrics: [
          { metricDefinitionId: "mid-1", value: 111 },
          { metricDefinitionId: "mid-2", value: 222 },
          { metricDefinitionId: "mid-3", value: 333 },
          { metricDefinitionId: "mid-4", value: 444 },
          { metricDefinitionId: "mid-5", value: 555 },
        ],
      }),
    };

    const result = await handleAnyRequest(event as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(4);
    expect(ddbMock).toHaveReceivedCommandWith(PutItemCommand, {
      TableName: "MockBenchmarkRunsTable",
      Item: {
        fullRunId: { S: "the-org-id#the-benchmark-id" },
        executedOn: { N: "123456789" },
        jenkinsJobNumber: { N: "0" },
      },
    });
    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: "{}",
    });
  });

  it("should split benchmark values in different partitions", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      httpMethod: "POST",
      // @ts-ignore
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      body: JSON.stringify({
        benchmarkId: "the-benchmark-id",
        executedOn: 123456789,
        metrics: [
          { metricDefinitionId: "mid-1", value: 111 },
          { metricDefinitionId: "mid-2", value: 222 },
          { metricDefinitionId: "mid-3", value: 333 },
          { metricDefinitionId: "mid-4", value: 444 },
          { metricDefinitionId: "mid-5", value: 555 },
        ],
      }),
    };

    const result = await handleAnyRequest(event as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(4);
    expect(ddbMock).toHaveReceivedCommandWith(BatchWriteItemCommand, {
      RequestItems: {
        MockBenchmarkValuesTable: [
          {
            PutRequest: {
              Item: {
                fullValueId: { S: "the-org-id#the-benchmark-id#mid-1" },
                executedOn: { N: "123456789" },
                value: { N: "111" },
              },
            },
          },
          {
            PutRequest: {
              Item: {
                fullValueId: { S: "the-org-id#the-benchmark-id#mid-2" },
                executedOn: { N: "123456789" },
                value: { N: "222" },
              },
            },
          },
          {
            PutRequest: {
              Item: {
                fullValueId: { S: "the-org-id#the-benchmark-id#mid-3" },
                executedOn: { N: "123456789" },
                value: { N: "333" },
              },
            },
          },
          {
            PutRequest: {
              Item: {
                fullValueId: { S: "the-org-id#the-benchmark-id#mid-4" },
                executedOn: { N: "123456789" },
                value: { N: "444" },
              },
            },
          },
          {
            PutRequest: {
              Item: {
                fullValueId: { S: "the-org-id#the-benchmark-id#mid-5" },
                executedOn: { N: "123456789" },
                value: { N: "555" },
              },
            },
          },
        ],
      },
    });
    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: "{}",
    });
  });

  it("should aggregate the monitored metrics", async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      headers: {
        "content-type": "application/json",
      },
      httpMethod: "POST",
      // @ts-ignore
      requestContext: {
        authorizer: {
          claims: {
            "custom:orgId": "the-org-id",
          },
        },
      },
      body: JSON.stringify({
        benchmarkId: "the-benchmark-id",
        executedOn: 123456789,
        metrics: [
          { metricDefinitionId: "mid-1", value: 111 },
          { metricDefinitionId: "mid-2", value: 222 },
          { metricDefinitionId: "mid-3", value: 333 },
          { metricDefinitionId: "mid-4", value: 444 },
          { metricDefinitionId: "mid-5", value: 555 },
        ],
      }),
    };

    const result = await handleAnyRequest(event as APIGatewayProxyEvent);

    expect(ddbMock.calls().length).toEqual(4);
    expect(ddbMock).toHaveReceivedCommandWith(UpdateItemCommand, {
      TableName: "MockMonitoredMetricsTable",
      Key: {
        orgId: { S: "the-org-id" },
        benchmarkId: { S: "the-benchmark-id" },
      },
      UpdateExpression: "ADD #metricDefinitionIds :metricDefinitionIds",
      ExpressionAttributeNames: {
        "#metricDefinitionIds": "metricDefinitionIds",
      },
      ExpressionAttributeValues: {
        ":metricDefinitionIds": {
          SS: ["mid-1", "mid-2", "mid-3", "mid-4", "mid-5"],
        },
      },
    });
    expect(result).toEqual({
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: "{}",
    });
  });
});
