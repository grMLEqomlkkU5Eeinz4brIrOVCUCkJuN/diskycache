module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	roots: ["<rootDir>/src", "<rootDir>/test"],
	testMatch: [
		"**/__tests__/**/*.+(ts|tsx|js)",
		"**/*.(test|spec).+(ts|tsx|js)"
	],
	transform: {
		"^.+\\.tsx?$": "ts-jest",
	},
	collectCoverageFrom: [
		"src/**/*.{ts,tsx}",
		"!src/**/*.d.ts",
	],
	coverageDirectory: "coverage",
	coverageReporters: ["text", "lcov", "html"],
};