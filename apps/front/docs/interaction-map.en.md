NovAI – Complete Interaction Specification (v0.1, Cursor-Ready English Version)
COPY EVERYTHING BELOW AS ONE FILE INTO Cursor
NovAI – Interaction & Logic Specification (v0.1, SSOT – Single Source of Truth)

Cursor MUST strictly follow this specification when wiring frontend logic.
All interactions, routing rules, guards, and mock APIs are defined here.
Backend is NOT ready, ALL data comes from frontend mocks.

0. GLOBAL LOGIC
0.1 Routes

/                 (landing page)
/login
/register
/forgot-password
/dashboard
/novels
/create
/create/quick
/novel/writing    (query: ?novelId=<id>)
/recharge

0.2 Global Auth State (frontend)

Cursor must create a global auth store (Context/Zustand/Redux is fine):

auth = {
  isAuthenticated: boolean,
  user?: {
    id: string,
    email: string,
    nickname: string,
    avatarUrl?: string,
    points?: number
  } | null
}

Token is stored in localStorage (key: "novai_token").

On app load:

- read token from localStorage
- if exists → mockGetCurrentUser(token)
  - success → isAuthenticated = true, set user
  - failure → clear token, isAuthenticated = false, user = null

login(email, password):

- mockLogin(email, password)
- on success:
  - save token
  - isAuthenticated = true
  - set user

logout():

- clear token
- isAuthenticated = false
- user = null

0.3 Global Header Behavior

Top header exists on all pages (except maybe login/register if you want):

If NOT authenticated:

- show nav: Home ("/"), My Novels ("/novels"), New Novel ("/create"), Recharge ("/recharge")
- clicking any protected nav (My Novels / New Novel / Recharge) when not logged in:
  → /login?redirect=<targetRoute>

- right side buttons:
  - Login → /login
  - Register → /register

If authenticated:

- show nav: Home ("/"), My Novels ("/novels"), New Novel ("/create"), Recharge ("/recharge"), Dashboard ("/dashboard")
- clicking:
  - My Novels → /novels
  - New Novel → /create
  - Recharge → /recharge
  - Dashboard → /dashboard

- right side avatar dropdown:
  - Dashboard → /dashboard
  - Change Password → /forgot-password
  - Security Settings → just show alert("敬请期待")
  - Logout → clear auth, go /login

0.4 Route Guards

Protected routes: /dashboard, /novels, /create, /create/quick, /novel/writing, /recharge

If user is NOT authenticated and tries to access a protected route:

→ redirect to /login?redirect=<currentURL>

0.5 Mock-Only Mode

All data comes from mock functions (see section 9).
No real HTTP calls.

--------------------------------------------------
1. AUTH
--------------------------------------------------

1.1 Register (/register)

Fields:

- email
- nickname
- password
- confirmPassword

Flow:

- validate required fields
- ensure email has "@"
- password length ≥ 6
- confirmPassword matches password

on submit:

- call mockRegister({ email, nickname, password })
- success:
  - auth.isAuthenticated = true
  - auth.user = mock user (email + nickname)
  - redirect → /dashboard  (or ?redirect= if provided)
- failure:
  - show "请求失败"

1.2 Login (/login)

Fields:

- email
- password
- rememberMe (checkbox, UI only)

Flow:

- validate required
- call mockLogin({ email, password })

on success:

- auth.isAuthenticated = true
- auth.user = mock user
- read redirect:
  - if URL has redirect → go redirect
  - else → /dashboard

on failure:

- show "请求失败"

Extra:

- "忘记密码？" link → /forgot-password

1.3 Forgot Password (/forgot-password)

Field:

- email

Flow:

- validate email
- call mockRequestResetPassword(email)
- on success: show message "重置链接已发送（Mock）"
- on failure: show "请求失败"

--------------------------------------------------
2. HOME (/) 
--------------------------------------------------

Hero buttons:

- "开始创作" (Start Writing):

  if NOT logged in:
    → /register
  else:
    → /create

- "观看演示" (Watch Demo):
  - for now: alert("演示功能开发中") or /novels?demo=1

Top-right buttons:

- "登录" → /login
- "开始创作" → same logic as above

Bottom CTA:

- "立即注册" → /register
- "立即登录" → /login

--------------------------------------------------
3. DASHBOARD (/dashboard)
--------------------------------------------------

Guarded: must be logged in.

On page load:

- call mockGetDashboardSummary()

Dashboard Summary includes at least:

- totalNovels
- totalWords
- totalChapters
- membershipLabel
- membershipExpireAt
- recentNovels: list of novel cards

UI behavior:

- top nav: same as global header (My Novels/New Novel/Recharge/Dashboard)
- stats cards: show numbers from summary
- user card: use auth.user + membership info

"创作趋势" (creative trend) section:

- can be static placeholder text for now (e.g. "趋势图开发中")

"最近创作" (Recent creations) list:

- show items from summary.recentNovels
- clicking any item:

  → /novel/writing?novelId=<novel.id>

--------------------------------------------------
4. MY NOVELS (/novels)
--------------------------------------------------

Guarded: must be logged in.

Top area: search bar + filters.

On page load:

- read URL query: q, status, genre, sort
- call mockListNovels({ q, status, genre, sort })

Novel card:

- clicking card body → /novel/writing?novelId=<id>
- status badge text:
  - writing → "创作中"
  - completed → "已完结"
  - dropped → "已弃坑"

- right-bottom icons:
  - Edit → /novel/writing?novelId=<id>
  - Favorite star:
    - toggle favorite state (mock only)
  - Delete:
    - confirm("确定要删除这部小说吗？")
    - on confirm:
      - call mockDeleteNovel(id)
      - remove from list
    - on failure: show "请求失败"

Filters:

- typing + Enter in search box → reload mockListNovels with q
- changing status/genre/sort → update URL + reload list

Empty state:

- if no novels:
  - show message "还没有作品，去创建一部吧"
  - button → /create

--------------------------------------------------
5. CREATE FLOW
--------------------------------------------------

5.1 Mode selection (/create)

Guarded.

Two cards:

- Quick Create:

  button click → /create/quick

- Advanced Create:

  for now: alert("高级创作模式开发中")
  (or also redirect to /create/quick)

5.2 Quick Create (/create/quick)

Guarded.

Fields:

- prompt (textarea) – required, ≥ 10 chars
- category (tags) – single selection
- chapterLength (select)
- style (select)

Flow:

- validate prompt length
- on submit:
  - call mockQuickCreateNovel({ prompt, category, chapterLength, style })

on success:

- returns novelId
- redirect → /novel/writing?novelId=<novelId>

on failure:

- if error message includes "点数不足" (points not enough):
  - ask confirm("创作点不足，是否前往充值中心？")
  - confirm → /recharge
- else show "请求失败"

--------------------------------------------------
6. NOVEL WRITING (/novel/writing)
--------------------------------------------------

Guarded.

Query param:

- novelId (required)

On load:

- if no novelId → redirect /novels
- else:
  - call mockGetCurrentChapter(novelId)

Page layout:

- left: chapter title + content
- right: character info + story style + tension + stage
- bottom/middle: "选择你的行动" (choose your action) list

Chapter info from mock:

- title, index, wordCount, sceneCount, content, currentStoryPoint
- characters list
- options list

Choose Action Flow:

- options: list of cards

When user clicks an option card:

1. highlight selected option
2. show confirm("确定选择该行动吗？NovAI 将基于此生成下一章节。")
3. if cancelled → do nothing else
4. if confirmed:
   - call mockChooseChapterOption({ novelId, chapterId, optionId })

on success:

- call mockGetCurrentChapter(novelId) again
- replace current chapter (显示下一章)

on failure:

- show "请求失败"

"重新开始本章选择" button:

- clear current selection
- optional: re-fetch current chapter again from mock

--------------------------------------------------
7. RECHARGE CENTER (/recharge)
--------------------------------------------------

Guarded.

On page load:

- call mockGetRechargePackages()
- call mockGetRechargeRecords()
- default selected package:
  - first with isRecommended = true
  - else first in list

Left side – Choose amount:

- show package cards
- clicking a card → set selectedPackageId
- "自定义金额" card → alert("自定义金额开发中")

Payment method area:

- buttons: Alipay, WeChat
- clicking button → set current payment method

"立即支付 ¥X" button:

- X = selected package price
- on click:

  if no package selected:
    alert("请选择充值档位")

  else:
    call mockCreateRechargeOrder({ packageId, method })

on success:

- add a new record (mock)
- show alert("模拟支付成功，创作点已增加")
- optional: reload records & user info

on failure:

- show "请求失败"

Right side:

- "当前创作点余额" → from auth.user.points (mock)
- "最近充值记录" → from mock records

--------------------------------------------------
8. ERROR HANDLING & LOADING
--------------------------------------------------

For every mock call:

- show loading state while waiting
- on error (mock promise reject):
  - show "请求失败" (or error.message)
  - allow retry (e.g. a "重试" button for dashboard / lists)

For every form submit:

- disable submit button while request in-flight
- re-enable after success/failure

--------------------------------------------------
9. MOCK API REQUIREMENTS
--------------------------------------------------

Cursor MUST implement these mock functions under src/mock/ (or similar):

mockGetCurrentUser(token): Promise<user>
mockRegister({ email, nickname, password }): Promise<{ token, user }>
mockLogin({ email, password }): Promise<{ token, user }>
mockRequestResetPassword(email): Promise<any>

mockGetDashboardSummary(): Promise<{
  totalNovels, totalWords, totalChapters, membershipLabel, membershipExpireAt, recentNovels
}>

mockListNovels(filters): Promise<Novel[]>
mockDeleteNovel(id): Promise<any>

mockQuickCreateNovel({ prompt, category, chapterLength, style }): Promise<{ novelId }>

mockGetCurrentChapter(novelId): Promise<ChapterDetail>
mockChooseChapterOption({ novelId, chapterId, optionId }): Promise<any>

mockGetRechargePackages(): Promise<RechargePackage[]>
mockGetRechargeRecords(): Promise<RechargeRecord[]>
mockCreateRechargeOrder({ packageId, method }): Promise<{ orderId, payUrl?: string }>

Rules:

- Resolve on success with mock data.
- Reject on failure (to test error paths).
- UI shows "请求失败" (or more detailed message) on failure.

END OF FILE — THIS IS THE COMPLETE v0.1 NOVAI SPEC
Cursor MUST strictly follow this document to implement all behaviors.
