function getEnv(name: string): string {
  let val = process.env[name];
  if (val === undefined || val === null) {
    throw "Missing environment variable " + name;
  }
  return val;
}

export const benchmarkDefinitionsTableName: string =
  getEnv("BENCHMARK_DEFINITIONS_TABLE_NAME");

export const benchmarkRunsTableName: string =
  getEnv("BENCHMARK_RUNS_TABLE_NAME");

export const benchmarkValuesTableName: string =
  getEnv("BENCHMARK_VALUES_TABLE_NAME");

export const monitoredMetricsTableName: string =
  getEnv("MONITORED_METRICS_TABLE_NAME");
