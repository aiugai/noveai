/** @type {import('prettier').Config} */
export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  bracketSpacing: true,
  endOfLine: 'lf',
  arrowParens: 'avoid',
  // 针对不同文件类型的覆盖配置
  overrides: [
    {
      files: '*.md',
      options: {
        printWidth: 80,
        proseWrap: 'preserve',
      },
    },
    {
      files: '*.json',
      options: {
        printWidth: 80,
      },
    },
  ],
}
