export default {
    projects: ["<rootDir>/jest.integration.config.ts","<rootDir>/jest.unit.config.ts"],
    transform: {
        '^.+\\.ts?$': 'esbuild-jest',
    },
    clearMocks: true,
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageProvider: 'v8',
    verbose: true,
    testMatch: ['__tests__/**/*.test.ts']
};
