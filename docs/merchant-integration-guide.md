# 外部商户支付对接指南

## 概述

本文档描述外部商户如何接入平台支付系统。商户通过签名认证方式将用户引导至平台充值页面完成支付。

## 接入流程

```
商户系统                              平台
   │
   ├── 1. 生成签名，跳转用户 ──────> /recharge?merchant_id=xxx&...
   │                                    │
   │                                    ├── 用户选择套餐
   │                                    ├── 前端调用创建订单 API
   │                                    ├── 用户完成支付
   │                                    ↓
   │<───────── 2. 支付回调 ─────────  平台主动通知商户（含套餐详情）
   │
   └── 3. 查询订单状态（可选）──────> GET /api/payment/external/order-status
```

**商户需要做的事情**：
1. 生成签名参数，将用户跳转到平台充值页面
2. 提供回调地址，接收支付结果通知（含用户选购的套餐详情）
3. （可选）主动查询订单状态

**安全设计要点**：
- 商户签名仅验证身份，不绑定具体金额
- 用户在平台自由选择套餐，金额由平台数据库决定
- 回调中包含完整套餐信息并参与签名，防止篡改

---

## 1. 跳转充值页面

### 1.1 跳转地址

```
https://{平台域名}/recharge?merchant_id=xxx&business_order_id=xxx&ret_url=xxx&timestamp=xxx&sign=xxx
```

### 1.2 URL 参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| merchant_id | string | 是 | 商户标识（由平台分配）|
| business_order_id | string | 是 | 商户业务订单号（用于幂等，最长 100 字符）|
| ret_url | string | 是 | 支付成功后跳转地址（需 URL 编码）|
| extra_data | string | 否 | 商户自定义数据（JSON 字符串，需 URL 编码）|
| timestamp | number | 是 | 请求时间戳（秒级 Unix 时间戳）|
| sign | string | 是 | HMAC-SHA256 签名 |

### 1.3 跳转示例

```
https://example.com/recharge?merchant_id=merchant_001&business_order_id=BIZ202512020001&ret_url=https%3A%2F%2Fmerchant.com%2Fsuccess&timestamp=1733097600&sign=a1b2c3d4...
```

---

## 2. 签名算法

### 2.1 算法说明

- **算法**: HMAC-SHA256
- **密钥**: 由平台分配的 `secret_key`
- **时间戳**: 秒级 Unix 时间戳，允许 ± 5 分钟误差

### 2.2 签名步骤

1. **筛选参数**: 排除 `sign` 字段和值为空的参数
2. **字典序排序**: 按参数名 ASCII 码升序排列
3. **拼接字符串**: 格式为 `key1=value1&key2=value2&...`
4. **计算签名**: 使用 HMAC-SHA256 算法，输出 64 位十六进制字符串

### 2.3 签名参与字段

跳转充值页面时，签名参与字段：
- `business_order_id`
- `extra_data`（若有）
- `merchant_id`
- `ret_url`
- `timestamp`

> **设计说明**：商户签名不包含 `amount` 和 `packageId`，因为：
> 1. 用户跳转到平台后可以**自由选择套餐**，商户无法预知用户会购买哪个套餐
> 2. 套餐价格由**平台数据库配置**，后端根据 `packageId` 获取价格，无法被前端篡改
> 3. 支付完成后，回调中会包含完整的 `productInfo`（套餐详情）**并参与签名**，防止被篡改

### 2.4 签名示例

**参数**:
```json
{
  "merchant_id": "merchant_001",
  "business_order_id": "BIZ202512020001",
  "ret_url": "https://merchant.com/success",
  "timestamp": 1733097600
}
```

**待签名字符串**（按字典序排列）:
```
business_order_id=BIZ202512020001&merchant_id=merchant_001&ret_url=https://merchant.com/success&timestamp=1733097600
```

### 2.5 各语言签名代码

**Node.js**:
```javascript
const crypto = require('crypto')

function generateSignature(params, secretKey) {
  // 1. 筛选非空参数，排除 sign
  const filteredParams = Object.entries(params)
    .filter(([key, value]) => key !== 'sign' && value !== undefined && value !== '')

  // 2. 按 key 字典序排序
  const sortedParams = filteredParams.sort(([a], [b]) => a.localeCompare(b))

  // 3. 拼接为 key=value&key=value 格式
  const queryString = sortedParams
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  // 4. 计算 HMAC-SHA256
  return crypto
    .createHmac('sha256', secretKey)
    .update(queryString)
    .digest('hex')
}

// 生成跳转 URL
function buildRechargeUrl(baseUrl, params, secretKey) {
  const sign = generateSignature(params, secretKey)
  const queryParams = new URLSearchParams({
    ...params,
    sign
  })
  return `${baseUrl}/recharge?${queryParams.toString()}`
}

// 使用示例
const params = {
  merchant_id: 'merchant_001',
  business_order_id: 'BIZ202512020001',
  ret_url: 'https://merchant.com/success',
  timestamp: Math.floor(Date.now() / 1000)
}
const url = buildRechargeUrl('https://example.com', params, 'your-secret-key')
console.log(url)
```

**Python**:
```python
import hmac
import hashlib
import time
from urllib.parse import urlencode

def generate_signature(params: dict, secret_key: str) -> str:
    # 1. 筛选非空参数，排除 sign
    filtered = {k: v for k, v in params.items()
                if k != 'sign' and v is not None and v != ''}

    # 2. 按 key 字典序排序
    sorted_keys = sorted(filtered.keys())

    # 3. 拼接为 key=value&key=value 格式
    query_string = '&'.join([f'{k}={filtered[k]}' for k in sorted_keys])

    # 4. 计算 HMAC-SHA256
    signature = hmac.new(
        secret_key.encode('utf-8'),
        query_string.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    return signature

def build_recharge_url(base_url: str, params: dict, secret_key: str) -> str:
    sign = generate_signature(params, secret_key)
    params['sign'] = sign
    return f'{base_url}/recharge?{urlencode(params)}'

# 使用示例
params = {
    'merchant_id': 'merchant_001',
    'business_order_id': 'BIZ202512020001',
    'ret_url': 'https://merchant.com/success',
    'timestamp': int(time.time())
}
url = build_recharge_url('https://example.com', params, 'your-secret-key')
print(url)
```

**PHP**:
```php
<?php
function generateSignature(array $params, string $secretKey): string {
    // 1. 筛选非空参数，排除 sign
    $filtered = array_filter($params, function($value, $key) {
        return $key !== 'sign' && $value !== null && $value !== '';
    }, ARRAY_FILTER_USE_BOTH);

    // 2. 按 key 字典序排序
    ksort($filtered);

    // 3. 拼接为 key=value&key=value 格式
    $queryString = http_build_query($filtered, '', '&', PHP_QUERY_RFC3986);

    // 4. 计算 HMAC-SHA256
    return hash_hmac('sha256', $queryString, $secretKey);
}

function buildRechargeUrl(string $baseUrl, array $params, string $secretKey): string {
    $params['sign'] = generateSignature($params, $secretKey);
    return $baseUrl . '/recharge?' . http_build_query($params);
}

// 使用示例
$params = [
    'merchant_id' => 'merchant_001',
    'business_order_id' => 'BIZ202512020001',
    'ret_url' => 'https://merchant.com/success',
    'timestamp' => time()
];
$url = buildRechargeUrl('https://example.com', $params, 'your-secret-key');
echo $url;
```

---

## 3. 支付回调通知

支付完成后，平台会向商户配置的回调地址发送 HTTP POST 请求。

### 3.1 回调请求

```
POST {商户回调地址}
Content-Type: application/json
```

### 3.2 回调参数

| 参数 | 类型 | 说明 |
|------|------|------|
| paymentOrderId | string | 平台订单 ID |
| businessOrderId | string | 商户业务订单号 |
| merchantId | string | 商户标识 |
| amount | string | 商户期望金额（美元，用于签名验证）|
| currency | string | 商户期望币种（固定 `USD`）|
| settledAmount | string | 实际结算金额（可能因汇率转换与 amount 不同）|
| settledCurrency | string | 实际结算币种（如 `CNY`）|
| status | string | 支付状态：`COMPLETED` / `FAILED` |
| paidAt | string | 支付时间（ISO 8601）|
| productInfo | object | 套餐信息（用户选购的商品详情，见下表）|
| timestamp | number | 回调时间戳（毫秒）|
| sign | string | HMAC-SHA256 签名 |

### 3.3 套餐信息（productInfo）

用户在平台选购的套餐详情。**参与签名计算**（使用 `product_` 前缀扁平化），防止被篡改。

| 参数 | 类型 | 说明 |
|------|------|------|
| id | string | 套餐 ID |
| name | string | 套餐名称（内部标识）|
| displayTitle | string | 展示标题（如"入门套餐"）|
| badgeLabel | string | 徽章标签（如"热门"，可选）|
| priceAmount | string | 套餐价格（美元）|
| priceCurrency | string | 套餐币种（固定 `USD`）|
| baseScore | number | 基础积分 |
| bonusScore | number | 赠送积分 |
| totalScore | number | 总积分（基础 + 赠送）|

### 3.4 回调示例

```json
{
  "paymentOrderId": "cm1a2b3c4d5e6f7g8",
  "businessOrderId": "BIZ202512020001",
  "merchantId": "merchant_001",
  "amount": "9.99",
  "currency": "USD",
  "settledAmount": "72.50",
  "settledCurrency": "CNY",
  "status": "COMPLETED",
  "paidAt": "2025-12-02T10:30:00.000Z",
  "productInfo": {
    "id": "pkg_001",
    "name": "COIN_PACK_100",
    "displayTitle": "入门套餐",
    "badgeLabel": "热门",
    "priceAmount": "9.99",
    "priceCurrency": "USD",
    "baseScore": 100,
    "bonusScore": 10,
    "totalScore": 110
  },
  "timestamp": 1733098200000,
  "sign": "a1b2c3d4e5f6..."
}
```

### 3.5 回调验签

商户收到回调后，**必须验证签名**。

**签名参与字段**（按字典序）:

基础字段：
- `amount`
- `businessOrderId`
- `currency`
- `merchantId`
- `paidAt`
- `paymentOrderId`
- `settledAmount`
- `settledCurrency`
- `status`
- `timestamp`

套餐信息字段（使用 `product_` 前缀扁平化，若有 productInfo）：
- `product_baseScore`
- `product_badgeLabel`（若有）
- `product_bonusScore`
- `product_displayTitle`
- `product_id`
- `product_name`
- `product_priceAmount`
- `product_priceCurrency`
- `product_totalScore`

**Node.js 验签示例**:
```javascript
function verifyCallback(payload, secretKey) {
  const { sign, productInfo, ...baseParams } = payload

  // 构建签名参数（扁平化 productInfo）
  const signParams = { ...baseParams }
  if (productInfo) {
    signParams.product_id = productInfo.id
    signParams.product_name = productInfo.name
    signParams.product_displayTitle = productInfo.displayTitle
    if (productInfo.badgeLabel) {
      signParams.product_badgeLabel = productInfo.badgeLabel
    }
    signParams.product_priceAmount = productInfo.priceAmount
    signParams.product_priceCurrency = productInfo.priceCurrency
    signParams.product_baseScore = productInfo.baseScore
    signParams.product_bonusScore = productInfo.bonusScore
    signParams.product_totalScore = productInfo.totalScore
  }

  const expectedSign = generateSignature(signParams, secretKey)
  return sign === expectedSign
}

// Express 示例
app.post('/callback', (req, res) => {
  const isValid = verifyCallback(req.body, 'your-secret-key')
  if (!isValid) {
    return res.status(403).send('FAIL')
  }

  // 处理业务逻辑（更新订单状态、发放商品等）
  // 注意：需做幂等处理，同一订单可能收到多次回调
  // productInfo 包含用户购买的套餐详情，可记录到商户系统

  res.send('SUCCESS')
})
```

### 3.6 回调响应

商户处理完成后，需返回纯文本响应：

| 响应内容 | HTTP 状态码 | 说明 |
|---------|------------|------|
| `SUCCESS` | 200 | 处理成功，平台停止重试 |
| `FAIL` | 非 200 | 处理失败，平台将重试 |

### 3.7 重试机制

| 重试次数 | 间隔时间 |
|---------|---------|
| 第 1 次 | 立即 |
| 第 2 次 | 1 分钟后 |
| 第 3 次 | 5 分钟后 |
| 第 4 次 | 15 分钟后 |

超过最大重试次数后，商户需主动调用订单查询接口获取最终状态。

---

## 4. 查询订单状态

商户可主动查询订单状态，用于：
- 回调未收到时主动查询
- 对账核实订单状态
- **回调失败时获取完整 productInfo 重建回调请求**

平台提供两种查询方式：

### 4.1 方式一：公开订单查询（推荐）

无需签名验证，通过订单 ID 直接查询。适用于前端轮询和回调失败后的数据恢复。

**请求**:
```
GET /api/payment/external/orders/{orderId}
```

**响应示例**:
```json
{
  "id": "cm1a2b3c4d5e6f7g8",
  "amount": "9.990000",
  "currency": "USD",
  "channel": "WGQPAY",
  "status": "COMPLETED",
  "payUrl": "https://payment-gateway.com/pay/xxx",
  "returnUrl": "https://merchant.com/success",
  "businessOrderId": "BIZ202512020001",
  "productInfo": {
    "id": "pkg_001",
    "name": "COIN_PACK_100",
    "displayTitle": "入门套餐",
    "badgeLabel": "热门",
    "priceAmount": "9.99",
    "priceCurrency": "USD",
    "baseScore": 100,
    "bonusScore": 10,
    "totalScore": 110
  },
  "createdAt": "2025-12-02T10:00:00.000Z",
  "completedAt": "2025-12-02T10:30:00.000Z",
  "expiresAt": "2025-12-02T11:00:00.000Z"
}
```

**重要说明**:
- 响应包含完整的 `productInfo`，与回调通知中的结构完全一致
- 当回调失败需要重建 `PaymentCenterCallbackDto` 时，可从此接口获取完整套餐信息
- 此接口仅返回外部商户创建的订单，内部订单返回 404
- 响应已脱敏，不包含 `merchantId`、`callbackUrl` 等敏感字段

### 4.2 方式二：签名验证查询

需要商户签名验证，通过业务订单号查询。

**请求**:
```
GET /api/payment/external/order-status?merchantId=xxx&businessOrderId=xxx&timestamp=xxx&sign=xxx
```

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| merchantId | string | 是 | 商户标识 |
| businessOrderId | string | 是 | 商户业务订单号 |
| timestamp | number | 是 | 请求时间戳（秒级）|
| sign | string | 是 | HMAC-SHA256 签名 |

**签名参与字段**:
- `business_order_id`
- `merchant_id`
- `timestamp`

**成功响应（HTTP 200）**:
```json
{
  "status": "success",
  "productInfo": {
    "id": "pkg_001",
    "name": "COIN_PACK_100",
    "displayTitle": "入门套餐",
    "priceAmount": "9.99",
    "priceCurrency": "USD",
    "baseScore": 100,
    "bonusScore": 10,
    "totalScore": 110
  },
  "paidAt": "2025-12-02T10:30:00.000Z"
}
```

### 4.3 订单状态

| 状态 | 说明 |
|------|------|
| `pending` | 待支付 |
| `success` | 支付成功 |
| `failed` | 支付失败 |

### 4.4 错误响应

| HTTP 状态码 | 错误码 | 说明 |
|------------|--------|------|
| 400 | `EXTERNAL_PAYMENT_TIMESTAMP_EXPIRED` | 时间戳过期 |
| 403 | `EXTERNAL_PAYMENT_INVALID_SIGNATURE` | 签名验证失败 |
| 404 | `EXTERNAL_PAYMENT_MERCHANT_NOT_FOUND` | 商户不存在 |
| 404 | `EXTERNAL_PAYMENT_ORDER_NOT_FOUND` | 订单不存在 |

---

## 5. 错误码汇总

| 错误码 | HTTP 状态码 | 说明 |
|--------|------------|------|
| `EXTERNAL_PAYMENT_MERCHANT_NOT_FOUND` | 404 | 商户不存在 |
| `EXTERNAL_PAYMENT_MERCHANT_DISABLED` | 403 | 商户已禁用 |
| `EXTERNAL_PAYMENT_INVALID_SIGNATURE` | 403 | 签名验证失败 |
| `EXTERNAL_PAYMENT_TIMESTAMP_EXPIRED` | 400 | 时间戳过期（超出 ± 5 分钟）|
| `EXTERNAL_PAYMENT_ORDER_NOT_FOUND` | 404 | 订单不存在 |

---

## 6. 测试环境

### 6.1 测试地址

- **充值页面**: `https://staging.example.com/recharge`
- **API Base URL**: `https://api-staging.example.com`

### 6.2 测试商户

| 配置项 | 值 |
|--------|------|
| 商户 ID | `test_merchant` |
| 密钥 | `test_secret_key_12345` |
| 回调地址 | 商户提供 |

### 6.3 测试流程

1. 使用测试商户配置生成签名
2. 跳转用户到充值页面
3. 使用测试支付完成付款
4. 验证回调接收和订单状态

---

## 7. 安全建议

1. **密钥保护**: `secret_key` 必须妥善保管，仅在服务端使用，禁止暴露在前端代码中
2. **HTTPS 强制**: 所有请求必须使用 HTTPS
3. **时间戳校验**: 每次请求使用当前时间戳，避免重放攻击
4. **回调验签**: 务必验证回调签名，防止伪造通知
5. **幂等处理**: 回调可能重复发送，商户需做幂等处理（根据 businessOrderId 判断是否已处理）

---

## 8. 联系支持

如有对接问题，请联系技术支持团队。

- **邮箱**: support@example.com
- **文档更新日期**: 2025-12-02

---

## 附录 A：平台前端创建订单 API

> **说明**：本节面向平台前端开发者，描述 `/recharge` 页面如何调用后端 API 创建订单。

### A.1 接口信息

```
POST /api/payment/external/orders
Content-Type: application/json
```

### A.2 请求参数

| 参数 | 类型 | 必填 | 来源 | 说明 |
|------|------|------|------|------|
| merchantId | string | ✅ | URL query | 商户标识 |
| businessOrderId | string | ✅ | URL query | 商户业务订单号 |
| retUrl | string | ✅ | URL query | 支付成功后跳转地址 |
| extraData | string | ❌ | URL query | 商户自定义数据 |
| timestamp | number | ✅ | URL query | 请求时间戳（秒） |
| sign | string | ✅ | URL query | HMAC-SHA256 签名 |
| packageId | string | ✅ | 用户选择 | 用户选择的套餐 ID |

### A.3 安全设计

**重要**：前端**不传递**金额（`amount`）和支付方式（`method`）。

- 金额由后端根据 `packageId` 从数据库获取，防止前端篡改
- 支付方式由后端根据活跃渠道自动选择
- 商户签名参数原样透传，后端验证签名

### A.4 请求示例

```javascript
// 从 URL query 获取商户参数
const urlParams = new URLSearchParams(window.location.search)

// 用户选择套餐后调用
async function createOrder(packageId) {
  const response = await fetch('/api/payment/external/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // 商户签名参数（原样透传）
      merchantId: urlParams.get('merchant_id'),
      businessOrderId: urlParams.get('business_order_id'),
      retUrl: urlParams.get('ret_url'),
      extraData: urlParams.get('extra_data') || undefined,
      timestamp: Number(urlParams.get('timestamp')),
      sign: urlParams.get('sign'),
      // 用户选择参数
      packageId,
    }),
  })
  return response.json()
}
```

### A.5 响应示例

响应为脱敏的 `ExternalOrderPublicResponseDto`，支付链接直接通过 `payUrl` 字段返回：

```json
{
  "id": "cm1a2b3c4d5e6f7g8",
  "status": "PENDING",
  "amount": "72.500000",
  "currency": "CNY",
  "channel": "WGQPAY",
  "payUrl": "https://payment-gateway.com/pay/xxx",
  "returnUrl": "https://merchant.com/success",
  "businessOrderId": "BIZ202512020001",
  "productInfo": {
    "id": "pkg_001",
    "name": "COIN_PACK_100",
    "displayTitle": "入门套餐",
    "priceAmount": "9.99",
    "priceCurrency": "USD",
    "baseScore": 100,
    "bonusScore": 10,
    "totalScore": 110
  },
  "createdAt": "2025-12-02T10:00:00.000Z",
  "expiresAt": "2025-12-02T11:00:00.000Z"
}
```

前端收到响应后，根据 `payUrl` 跳转到支付页面（注意：旧版的 `paymentDetails.paymentUrl` 已废弃）。
