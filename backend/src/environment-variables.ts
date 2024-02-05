import { Lazy } from "./lazy";

function getEnv(name: string): Lazy<string> {
  return new Lazy(() => {
    const val = process.env[name];
    if (val === undefined || val === null) {
      throw new Error("Missing environment variable " + name);
    }
    return val;
  });
}

export const useCasesTableName: Lazy<string> = getEnv("USE_CASES_TABLE_NAME");

export const productsTableName: Lazy<string> = getEnv("PRODUCTS_TABLE_NAME");

export const environmentsTableName: Lazy<string> = getEnv(
  "ENVIRONMENTS_TABLE_NAME",
);

export const metricDefinitionsTableName: Lazy<string> = getEnv(
  "METRIC_DEFINITIONS_TABLE_NAME",
);

export const benchmarkDefinitionsTableName: Lazy<string> = getEnv(
  "BENCHMARK_DEFINITIONS_TABLE_NAME",
);

export const benchmarkRunsTableName: Lazy<string> = getEnv(
  "BENCHMARK_RUNS_TABLE_NAME",
);

export const benchmarkValuesTableName: Lazy<string> = getEnv(
  "BENCHMARK_VALUES_TABLE_NAME",
);

export const monitoredMetricsTableName: Lazy<string> = getEnv(
  "MONITORED_METRICS_TABLE_NAME",
);
