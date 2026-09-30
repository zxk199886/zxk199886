# Unknown

Solana 上的发射平台。名字就是理念：**未知是对开发者的约束**。

- **掷骰（The roll）**：开发者先承诺首购金额，再由可验证随机数（VRF）掷 2d6。点数和 × 3%（6%–36%）是可以随时取出卖掉的部分，其余部分在开盘后 3 小时内线性解锁。
- **迷雾（The fog）**：没有人知道什么时候开盘。每个 tick（默认 60 秒）重新抽一次随机数，开盘概率是 1/剩余 tick 数，所以开盘时刻在窗口内均匀分布，最后一个 tick 必定开盘。链上从不提前存储开盘时间，机器人也读不到。
- **金库（The vault）**：开发者的代币默认质押在金库里。创作者手续费的领取比例 = 当前质押量 ÷ 历史最高质押量，**只降不升**，也没有存回的指令。领不到的那部分手续费按持仓比例分给持有者。
- **封印（The seal）**：创建代币的同一笔交易里，mint、freeze、metadata 更新权限和 metadata pointer 权限全部放弃。曲线卖完后迁移到 Raydium CPMM，LP 全部销毁。

## 仓库结构

```
programs/unknown/   Anchor 程序（Rust）
  src/math.rs       曲线、手续费、骰子、解锁、系数、迷雾、merkle，纯函数，附 proptest
  src/vrf.rs        随机源：ORAO VRF；`mock-vrf` 构建下由管理员注入
  src/instructions/ create / settle / fog / trade / vault / holders / refund / graduate
packages/sdk/       TypeScript SDK：PDA、与 Rust 一致的 bigint 曲线计算、merkle、类型化 client
indexer/            事件索引（node:sqlite）+ HTTP/SSE API + crank + 持有者奖励发布
app/                Next.js 16 前端
tests/              链上集成测试（本地 validator + 从源码编译的 Raydium CPMM）
scripts/            本地链、测试、初始化、演示数据
```

## 链上设计要点

| 账户 | 作用 |
| --- | --- |
| `Config` | 手续费（默认协议 0.6% + 创作者 0.4%）、曲线参数、首购上下限、迷雾节奏、迁移费用 |
| `Launch` | 每个代币一个：状态机、虚拟/真实储备、骰子结果、迷雾 tick |
| `sol_vault` | 无数据的系统账户 PDA，存放曲线 SOL 和首购托管。所有 SOL 都通过签名的 system transfer 转出，毕业时它还是 Raydium 池子的创建者 |
| `DevVault` | 开发者代币、解锁进度、`staked`/`peak`/`coef_bps`、手续费记账 |
| `HolderPool` / `HolderEpoch` / `ClaimReceipt` | 持有者奖励池、每期 merkle root、防重复领取 |

状态机：`Rolling → Fogged → Trading → Complete → Graduated`。如果 VRF 超时未响应，状态变为 `Cancelled` 并退款。

防作弊细节：

- **首购在没人能交易的窗口里成交**：settle 时状态还是 Rolling，价格是确定的初始价。
- **开发者不能拒绝坏骰子**：settle 任何人都能调用，由 crank 立即执行。退款只在随机数*从未返回*时才允许，合约会检查。
- **只有金库里的币算数**：把代币直接转回金库的 token 账户不会改变 `staked`。系数用 `min()` 更新，只降不升，所以同一笔交易里"买回 → 领取 → 卖出"刷不回系数。测试覆盖了这一点。
- **毕业**：CPMM 的 `initialize` 通过手写 CPI 调用（避免依赖版本冲突），随后销毁 `sol_vault` 收到的全部 LP。

## 本地运行

需要 Node 22、pnpm、Rust、Solana CLI 2.3、Anchor 0.32。

```bash
pnpm install
anchor keys sync                    # 首次：用本地生成的程序密钥更新 declare_id
pnpm build:cpmm                     # 从源码编译 Raydium CPMM（本地钱包作为管理员）
pnpm build:program:mock && pnpm sync-idl

pnpm localnet                       # 终端 1：本地 validator（加载 Unknown、CPMM 和 fixture）
pnpm bootstrap                      # 初始化 Config 和 CPMM AmmConfig，会打印 CPMM_AMM_CONFIG=...
CPMM_AMM_CONFIG=<上一步的地址> pnpm indexer   # 终端 2：索引 + crank（本地充当 VRF 预言机）
cp app/.env.example app/.env.local && pnpm app   # 终端 3：http://localhost:3000
pnpm demo 4 --graduate              # 可选：生成几个发射、随机交易、推一个到毕业
```

本地可以用前端的 **Burner wallet** 连接，然后在钱包菜单里 Airdrop。本地迷雾为了演示加快了节奏（6 个 tick × 10 秒），生产参数是 30 × 60 秒。

## 测试

```bash
pnpm test:rust        # 数学模块：13 个单元测试 + proptest（K 不减、往返不获利、手续费守恒、系数单调、迷雾均匀）
pnpm test:program     # 17 个集成测试，从创建一直跑到 Raydium 毕业和 LP 销毁
pnpm --filter @unknown/sdk test
pnpm --filter @unknown/indexer test
```

## 部署到 devnet

1. `anchor build`（不带 `mock-vrf`，使用真实的 ORAO VRF）→ `anchor deploy --provider.cluster devnet`
2. `CLUSTER=devnet RPC_URL=<devnet RPC> pnpm bootstrap`（程序会使用 Raydium CPMM 的 devnet 程序 `DRaycpLY…`）
3. 在 Raydium 的 devnet 部署里选一个 `AmmConfig`，设置到 indexer 的 `CPMM_AMM_CONFIG`
4. indexer：`CLUSTER=devnet RPC_URL=... CPMM_AMM_CONFIG=... PUBLIC_URL=<公网地址> pnpm indexer`
5. 前端：`NEXT_PUBLIC_CLUSTER=devnet NEXT_PUBLIC_VRF_MODE=orao NEXT_PUBLIC_RPC_URL=... NEXT_PUBLIC_INDEXER_URL=...`

## 信任假设与已知局限

- **持有者奖励的快照由平台发布。** indexer 用 merkle authority 发布每期的 root，快照时排除曲线、金库、池子和开发者钱包。链上保证每期发放总额不超过池内未分配的余额，也不能重复领取，但分配比例需要信任发布者。以后可以改成链上质押领取。
- **开发者可以用小号在开盘后买入**，技术上拦不住。平台能做的是：首购有上限、必须掷骰，而且首购在没人能交易的窗口内完成。
- **毕业后 LP 已经销毁**，DEX 上的交易不再产生创作者费，金库系数只对曲线阶段的手续费生效。可以考虑改用 Meteora DAMM v2 的锁仓 position 来延续这部分收益。
- **metadata JSON 和图片目前由 indexer 托管**，适合开发链。主网应改用 Arweave 或 IPFS。
- 合约未经审计，上主网前必须审计。
