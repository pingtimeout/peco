module.exports = {
  displayName: "unit",
  testMatch: ["<rootDir>/__tests__/unit/**/*.test.ts"],
  transform: {
    "^.+\\.ts?$": "esbuild-jest",
  },
};
