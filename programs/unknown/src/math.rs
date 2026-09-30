//! Pure arithmetic shared by instructions. No account access here, so it is
//! unit- and property-tested natively (`cargo test`).

use solana_sha256_hasher::hashv;

use crate::constants::{BPS, LIQUID_BPS_PER_PIP, VEST_DURATION_SECS};

fn ceil_div(n: u128, d: u128) -> Option<u128> {
    if d == 0 {
        return None;
    }
    Some(n.checked_add(d - 1)? / d)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Curve {
    pub virtual_sol: u64,
    pub virtual_tokens: u64,
    pub real_sol: u64,
    pub real_tokens: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BuyQuote {
    /// SOL that enters the curve (after fees).
    pub sol_in: u64,
    pub tokens_out: u64,
}

impl Curve {
    /// Tokens out for `sol_in` net lamports, rounded down. If the curve can not
    /// fill the order, the order is capped at the remaining tokens and `sol_in`
    /// is reduced to the (rounded up) cost of exactly those tokens.
    pub fn quote_buy(&self, sol_in: u64) -> Option<BuyQuote> {
        let vs = self.virtual_sol as u128;
        let vt = self.virtual_tokens as u128;
        let sol = sol_in as u128;
        let out = vt.checked_mul(sol)? / vs.checked_add(sol)?;
        let out = out as u64;
        if out < self.real_tokens {
            return Some(BuyQuote { sol_in, tokens_out: out });
        }
        let tokens = self.real_tokens as u128;
        // Cost of `tokens`: vs * tokens / (vt - tokens), rounded up.
        let cost = ceil_div(vs.checked_mul(tokens)?, vt.checked_sub(tokens)?)?;
        Some(BuyQuote { sol_in: u64::try_from(cost).ok()?.min(sol_in), tokens_out: self.real_tokens })
    }

    /// Gross lamports out for selling `tokens_in`, rounded down.
    pub fn quote_sell(&self, tokens_in: u64) -> Option<u64> {
        let vs = self.virtual_sol as u128;
        let vt = self.virtual_tokens as u128;
        let t = tokens_in as u128;
        let out = vs.checked_mul(t)? / vt.checked_add(t)?;
        let out = u64::try_from(out).ok()?;
        (out <= self.real_sol).then_some(out)
    }

    pub fn apply_buy(&mut self, q: BuyQuote) -> Option<()> {
        self.virtual_sol = self.virtual_sol.checked_add(q.sol_in)?;
        self.real_sol = self.real_sol.checked_add(q.sol_in)?;
        self.virtual_tokens = self.virtual_tokens.checked_sub(q.tokens_out)?;
        self.real_tokens = self.real_tokens.checked_sub(q.tokens_out)?;
        Some(())
    }

    pub fn apply_sell(&mut self, tokens_in: u64, sol_out: u64) -> Option<()> {
        self.virtual_sol = self.virtual_sol.checked_sub(sol_out)?;
        self.real_sol = self.real_sol.checked_sub(sol_out)?;
        self.virtual_tokens = self.virtual_tokens.checked_add(tokens_in)?;
        self.real_tokens = self.real_tokens.checked_add(tokens_in)?;
        Some(())
    }

    pub fn k(&self) -> u128 {
        self.virtual_sol as u128 * self.virtual_tokens as u128
    }
}

/// Fee on an amount, rounded up (in the protocol's favour).
pub fn fee_on(amount: u64, fee_bps: u16) -> Option<u64> {
    u64::try_from(ceil_div(amount as u128 * fee_bps as u128, BPS as u128)?).ok()
}

/// Gross amount whose fee-deducted net is at least `net`.
pub fn gross_for_net(net: u64, fee_bps: u16) -> Option<u64> {
    let denom = BPS.checked_sub(fee_bps as u64)? as u128;
    let gross = u64::try_from(ceil_div(net as u128 * BPS as u128, denom)?).ok()?;
    // ceil on both sides can leave net one lamport short; bump until it holds.
    if gross.checked_sub(fee_on(gross, fee_bps)?)? >= net {
        Some(gross)
    } else {
        gross.checked_add(1)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct FeeSplit {
    pub protocol: u64,
    pub dev: u64,
    pub holders: u64,
}

impl FeeSplit {
    pub fn total(&self) -> u64 {
        self.protocol + self.dev + self.holders
    }
}

/// Splits `fee` between protocol and creator, then splits the creator share by
/// the vault coefficient: the dev keeps `coef_bps`, holders get the rest.
pub fn split_fee(fee: u64, protocol_bps: u16, creator_bps: u16, coef_bps: u16) -> FeeSplit {
    let total_bps = protocol_bps as u128 + creator_bps as u128;
    if fee == 0 || total_bps == 0 {
        return FeeSplit::default();
    }
    let creator = (fee as u128 * creator_bps as u128 / total_bps) as u64;
    let protocol = fee - creator;
    let dev = (creator as u128 * coef_bps.min(BPS as u16) as u128 / BPS as u128) as u64;
    FeeSplit { protocol, dev, holders: creator - dev }
}

/// 2d6 from the first two bytes of VRF output.
pub fn roll_dice(randomness: &[u8; 64]) -> (u8, u8) {
    (randomness[0] % 6 + 1, randomness[1] % 6 + 1)
}

pub fn liquid_bps_for(d1: u8, d2: u8) -> u16 {
    (d1 as u16 + d2 as u16) * LIQUID_BPS_PER_PIP
}

/// Splits the dev buy into (liquid, vesting) by the dice outcome.
pub fn split_dev_tokens(tokens: u64, liquid_bps: u16) -> (u64, u64) {
    let liquid = (tokens as u128 * liquid_bps as u128 / BPS as u128) as u64;
    (liquid, tokens - liquid)
}

/// Tokens the dev may have withdrawn in total by `now`.
pub fn unlocked(liquid_total: u64, vest_total: u64, vest_start: i64, now: i64) -> u64 {
    if vest_start == 0 || now <= vest_start {
        return liquid_total;
    }
    let elapsed = (now - vest_start).min(VEST_DURATION_SECS) as u128;
    let vested = vest_total as u128 * elapsed / VEST_DURATION_SECS as u128;
    liquid_total + vested as u64
}

/// New coefficient after the vault balance drops to `staked`.
/// `min` makes it monotonically non-increasing no matter what happens next.
pub fn next_coef(current_bps: u16, staked: u64, peak: u64) -> u16 {
    if peak == 0 {
        return current_bps;
    }
    let ratio = (staked as u128 * BPS as u128 / peak as u128) as u16;
    current_bps.min(ratio)
}

/// Fog hazard: at tick `tick` out of `max_ticks`, open with probability
/// 1 / (max_ticks - tick). Over the whole window this makes the opening tick
/// uniform, and the last tick always opens.
pub fn fog_opens(randomness: &[u8; 64], tick: u8, max_ticks: u8) -> bool {
    let remaining = max_ticks.saturating_sub(tick).max(1) as u64;
    let r = u64::from_le_bytes(randomness[0..8].try_into().unwrap());
    r % remaining == 0
}

pub fn fog_seed(mint: &[u8; 32], tick: u8) -> [u8; 32] {
    hashv(&[b"fog".as_slice(), mint.as_slice(), &[tick]]).to_bytes()
}

pub fn merkle_leaf(holder: &[u8; 32], amount: u64) -> [u8; 32] {
    hashv(&[&[0u8], holder.as_slice(), &amount.to_le_bytes()]).to_bytes()
}

/// Sorted-pair merkle verification: parents are H(0x01 || min || max).
pub fn verify_merkle(proof: &[[u8; 32]], root: &[u8; 32], leaf: [u8; 32]) -> bool {
    let mut node = leaf;
    for sibling in proof {
        node = if node <= *sibling {
            hashv(&[&[1u8], node.as_slice(), sibling.as_slice()]).to_bytes()
        } else {
            hashv(&[&[1u8], sibling.as_slice(), node.as_slice()]).to_bytes()
        };
    }
    node == *root
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    const SOL: u64 = 1_000_000_000;
    const TOK: u64 = 1_000_000;

    fn fresh() -> Curve {
        Curve {
            virtual_sol: 30 * SOL,
            virtual_tokens: 1_073_000_000 * TOK,
            real_sol: 0,
            real_tokens: 793_100_000 * TOK,
        }
    }

    #[test]
    fn sells_out_near_85_sol() {
        let c = fresh();
        let q = c.quote_buy(1_000 * SOL).unwrap();
        assert_eq!(q.tokens_out, c.real_tokens);
        let sol = q.sol_in as f64 / SOL as f64;
        assert!((sol - 85.0).abs() < 0.1, "sold out at {sol}");
    }

    #[test]
    fn dice_range() {
        assert_eq!(liquid_bps_for(1, 1), 600);
        assert_eq!(liquid_bps_for(6, 6), 3600);
        let mut r = [0u8; 64];
        r[0] = 5;
        r[1] = 11;
        assert_eq!(roll_dice(&r), (6, 6));
    }

    #[test]
    fn vesting_is_linear_and_capped() {
        assert_eq!(unlocked(100, 900, 0, 1_000), 100);
        assert_eq!(unlocked(100, 900, 1_000, 1_000), 100);
        assert_eq!(unlocked(100, 900, 1_000, 1_000 + VEST_DURATION_SECS / 3), 400);
        assert_eq!(unlocked(100, 900, 1_000, 1_000 + VEST_DURATION_SECS), 1_000);
        assert_eq!(unlocked(100, 900, 1_000, 1_000 + 10 * VEST_DURATION_SECS), 1_000);
    }

    #[test]
    fn coef_halves_when_half_sold_and_never_recovers() {
        let c = next_coef(10_000, 50, 100);
        assert_eq!(c, 5_000);
        // Even with a full balance again, min() keeps it down.
        assert_eq!(next_coef(c, 100, 100), 5_000);
        assert_eq!(next_coef(c, 25, 100), 2_500);
    }

    #[test]
    fn fog_last_tick_always_opens() {
        let r = [0xAB; 64];
        assert!(fog_opens(&r, 29, 30));
        assert!(fog_opens(&r, 40, 30));
    }

    #[test]
    fn fog_opening_is_uniform() {
        // Deterministic PRNG stand-in for VRF output.
        let mut state: u64 = 0x1234_5678;
        let mut counts = [0u32; 30];
        for _ in 0..30_000 {
            let mut tick = 0u8;
            loop {
                state = state.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
                let mut r = [0u8; 64];
                r[0..8].copy_from_slice(&(state >> 11).to_le_bytes());
                if fog_opens(&r, tick, 30) {
                    counts[tick as usize] += 1;
                    break;
                }
                tick += 1;
            }
        }
        for c in counts {
            assert!((800..1200).contains(&c), "non-uniform: {counts:?}");
        }
    }

    #[test]
    fn merkle_roundtrip() {
        let a = merkle_leaf(&[1; 32], 10);
        let b = merkle_leaf(&[2; 32], 20);
        let c = merkle_leaf(&[3; 32], 30);
        let pair = |x: [u8; 32], y: [u8; 32]| {
            let (l, r) = if x <= y { (x, y) } else { (y, x) };
            hashv(&[&[1u8], l.as_slice(), r.as_slice()]).to_bytes()
        };
        let ab = pair(a, b);
        let root = pair(ab, c);
        assert!(verify_merkle(&[b, c], &root, a));
        assert!(verify_merkle(&[ab], &root, c));
        assert!(!verify_merkle(&[ab], &root, merkle_leaf(&[3; 32], 31)));
    }

    #[test]
    fn gross_for_net_covers_net() {
        for net in [1u64, 99, 12_345, 85 * SOL, 999_999_999_999] {
            let g = gross_for_net(net, 100).unwrap();
            assert!(g - fee_on(g, 100).unwrap() >= net);
            assert!(g - 1 - fee_on(g - 1, 100).unwrap() < net);
        }
    }

    proptest! {
        #[test]
        fn k_never_decreases(buys in prop::collection::vec(1u64..20 * SOL, 1..20),
                             sell_frac in 1u64..100) {
            let mut c = fresh();
            let k0 = c.k();
            let mut held = 0u64;
            for b in buys {
                if c.real_tokens == 0 { break; }
                let q = c.quote_buy(b).unwrap();
                c.apply_buy(q).unwrap();
                held += q.tokens_out;
                prop_assert!(c.k() >= k0);
            }
            let sell = held * sell_frac / 100;
            if sell > 0 {
                let out = c.quote_sell(sell).unwrap();
                c.apply_sell(sell, out).unwrap();
                prop_assert!(c.k() >= k0);
            }
        }

        #[test]
        fn round_trip_never_profits(pre in 0u64..50 * SOL, amount in 1u64..30 * SOL) {
            let mut c = fresh();
            if pre > 0 {
                let q = c.quote_buy(pre).unwrap();
                c.apply_buy(q).unwrap();
            }
            let q = c.quote_buy(amount).unwrap();
            c.apply_buy(q).unwrap();
            let back = c.quote_sell(q.tokens_out).unwrap();
            prop_assert!(back <= q.sol_in);
        }

        #[test]
        fn fee_split_conserves(fee in 0u64..u64::MAX / 20_000, coef in 0u16..=10_000) {
            let s = split_fee(fee, 60, 40, coef);
            prop_assert_eq!(s.total(), fee);
        }

        #[test]
        fn coef_is_monotonic(steps in prop::collection::vec(0u64..=1_000, 1..30)) {
            let mut coef = 10_000u16;
            for staked in steps {
                let next = next_coef(coef, staked, 1_000);
                prop_assert!(next <= coef);
                coef = next;
            }
        }
    }
}
