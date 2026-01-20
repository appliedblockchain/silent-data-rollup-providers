module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: './',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/../../tsconfig.test.json',
      },
    ],
  },
  moduleNameMapper: {
    '^@appliedblockchain/silentdatarollup-core/tests$':
      '<rootDir>/../core/tests/index.ts',
  },
}
