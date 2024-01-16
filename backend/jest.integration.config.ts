module.exports = {
    displayName: "integration",
    testMatch: ['__tests__/integration/**/*.test.ts'],
    transform: {
        '^.+\\.ts?$': 'esbuild-jest',
    },
};
