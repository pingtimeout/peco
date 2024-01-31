function getEnv(name: string): string {
  const val = process.env[name];
  if (val === undefined || val === null) {
    throw new Error("Missing environment variable " + name);
  }
  return val;
}

export const useCasesTableName: string = getEnv("USE_CASES_TABLE_NAME");

export const productsTableName: string = getEnv("PRODUCTS_TABLE_NAME");

export const environmentsTableName: string = getEnv("ENVIRONMENTS_TABLE_NAME");

export const metricDefinitionsTableName: string = getEnv(
  "METRIC_DEFINITIONS_TABLE_NAME",
);

export const benchmarkDefinitionsTableName: string = getEnv(
  "BENCHMARK_DEFINITIONS_TABLE_NAME",
);

export const benchmarkRunsTableName: string = getEnv(
  "BENCHMARK_RUNS_TABLE_NAME",
);

export const benchmarkValuesTableName: string = getEnv(
  "BENCHMARK_VALUES_TABLE_NAME",
);

export const monitoredMetricsTableName: string = getEnv(
  "MONITORED_METRICS_TABLE_NAME",
);
