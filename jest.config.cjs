/**
 * Jest Configuration for PokeHabit Lambda Functions
 * 
 * 커버리지 설정 및 GitHub Flow를 위한 품질 게이트 포함
 */
module.exports = {
  // 테스트 환경
  testEnvironment: 'node',
  
  // 테스트 루트 디렉토리
  roots: ['<rootDir>/lambda'],
  
  // 테스트 파일 패턴
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  
  // 커버리지 수집 대상
  collectCoverageFrom: [
    'lambda/**/*.js',
    '!lambda/**/node_modules/**',
    '!lambda/**/coverage/**',
    '!lambda/**/__tests__/**',
    '!lambda/**/packages/**'
  ],
  
  // 모듈 별칭
  moduleNameMapper: {
    '^../../shared/(.*)$': '<rootDir>/lambda/shared/$1'
  },
  
  // 커버리지 출력 디렉토리
  coverageDirectory: '<rootDir>/coverage',
  
  // 커버리지 리포터 형식 (CI에서 JSON과 lcov 사용)
  coverageReporters: ['text', 'text-summary', 'lcov', 'json', 'html'],
  
  // 커버리지 임계값 - GitHub Flow에서 품질 게이트 역할
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 60,
      statements: 60
    }
  },
  
  // 테스트 타임아웃 (밀리초)
  testTimeout: 10000,
  
  // 테스트 실패 시 즉시 중단하지 않음
  bail: false,
  
  // 상세 출력
  verbose: true,
  
  // 각 테스트 후 자동으로 mock 정리
  clearMocks: true,
  resetMocks: false,
  restoreMocks: true,
  
  // 에러 발생 시 스택 트레이스 표시
  errorOnDeprecated: true,
  
  // 테스트 결과를 JUnit XML로 출력 (CI용)
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: './coverage',
      outputName: 'junit.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ]
};
