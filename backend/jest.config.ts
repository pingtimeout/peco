export default {
  projects: [
    "<rootDir>/jest.integration.config.ts",
    "<rootDir>/jest.unit.config.ts",
  ],
  transform: {
    "^.+\\.ts?$": [
      "esbuild-jest",
      {
        sourcemap: true,
      },
    ],
  },
  clearMocks: true,
  verbose: true,
  testMatch: ["__tests__/**/*.test.ts"],
};
