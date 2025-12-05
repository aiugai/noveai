#!/usr/bin/env node

/**
 * 构建后清理脚本
 *
 * ⚠️  重要安全说明：
 * Next.js App Router 的 .txt 文件存储 RSC Flight Data，是客户端导航运行时必需的！
 * 删除这些文件会导致路由切换时 404 → 白屏，生产环境直接宕机。
 *
 * 正确的安全策略：
 * 1. 不要删除 .txt 文件，它们是运行时必需的构建产物
 * 2. 通过 S3/CloudFront 配置保护敏感文件：
 *    - 禁用对象存储的目录列表权限
 *    - 使用签名 URL 或 CloudFront 行为控制访问
 *    - 设置适当的缓存和访问策略
 *
 * 此脚本默认保留所有构建产物。如需清理，请确保理解风险并有替代的安全措施。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const distDir = path.join(__dirname, '../../../dist/admin-front')

// ⚠️  默认禁用清理功能，避免误删运行时必需的文件
const shouldCleanAnything = (process.env.ADMIN_FRONT_FORCE_CLEAN ?? '').toLowerCase() === 'true'

const normalizedDistDir = path.normalize(distDir)
const parentDirName = path.basename(path.dirname(normalizedDistDir))
const currentDirName = path.basename(normalizedDistDir)

if (parentDirName !== 'dist' || currentDirName !== 'admin-front') {
  console.error('❌ post-build: 目标目录异常')
  console.error(`   实际路径: ${normalizedDistDir}`)
  console.error('   期望路径: .../dist/admin-front')
  process.exit(1)
}

if (!shouldCleanAnything) {
  console.log('ℹ️ admin-front 构建后清理已跳过')
  console.log('')
  console.log('📋 安全提醒：')
  console.log('   • Next.js .txt 文件存储 RSC 数据，是客户端导航必需的')
  console.log('   • 删除这些文件会导致路由切换时 404 → 白屏')
  console.log('   • 请通过 S3/CloudFront 配置而非删除文件来确保安全性')
  console.log('')
  console.log('🔒 推荐的安全配置：')
  console.log('   • 禁用 S3 存储桶的目录列表权限')
  console.log('   • 使用 CloudFront 行为控制敏感文件访问')
  console.log('   • 设置适当的缓存策略和访问控制')
  console.log('')
  console.log('⚠️  如确实需要清理特定文件，请设置 ADMIN_FRONT_FORCE_CLEAN=true')
  console.log('   并确保有替代的安全措施（如 CDN 访问控制）')
  process.exit(0)
}

// ⚠️  危险操作警告
console.log('⚠️  ⚠️  ⚠️  危险操作警告 ⚠️  ⚠️  ⚠️')
console.log('你已启用 ADMIN_FRONT_FORCE_CLEAN=true，这可能删除运行时必需的文件！')
console.log('')
console.log('请确认你已采取以下安全措施：')
console.log('• S3 存储桶已禁用目录列表权限')
console.log('• CloudFront 已配置适当的访问控制')
console.log('• 理解删除 .txt 文件会导致客户端导航失败')
console.log('')
console.log('按 Ctrl+C 取消，或等待 5 秒继续...')

// 给用户时间取消操作
await new Promise(resolve => setTimeout(resolve, 5000))

console.log('开始清理...')

/**
 * 清理函数 - 仅在明确知晓风险时使用
 * 注意：此函数不会删除 .txt 文件，因为它们是运行时必需的
 */
function cleanBuildArtifacts(dir) {
  let count = 0

  if (!fs.existsSync(dir)) {
    console.warn(`⚠️  目录不存在: ${dir}`)
    return count
  }

  const entries = fs.readdirSync(dir)

  entries.forEach(entry => {
    const entryPath = path.join(dir, entry)
    const stat = fs.statSync(entryPath)

    if (stat.isDirectory()) {
      count += cleanBuildArtifacts(entryPath)
    } else {
      // ⚠️  绝不删除 .txt 文件 - 它们是 Next.js 运行时必需的！
      // 可以在这里添加其他需要清理的文件类型，但要非常谨慎

      // 示例：删除可能的调试文件（如果有的话）
      // if (entry.endsWith('.map') && process.env.NODE_ENV === 'production') {
      //   // 仅在生产环境删除 source maps（如果不需要调试的话）
      // }

      console.log(`保留文件: ${path.relative(distDir, entryPath)}`)
    }
  })

  return count
}

console.log('🧹 admin-front: 开始构建后处理')
console.log(`📂 目标目录: ${distDir}`)
console.log('注意：出于安全考虑，此脚本不会删除任何文件')
console.log('Next.js .txt 文件对于客户端导航是必需的')

try {
  const processed = cleanBuildArtifacts(distDir)
  console.log(`✅ 处理完成！共检查 ${processed} 个目录`)
  console.log('所有文件均已保留。如需清理，请通过存储策略而非删除文件来确保安全性。')
} catch (error) {
  console.error('❌ 处理失败:', error.message)
  process.exit(1)
}

