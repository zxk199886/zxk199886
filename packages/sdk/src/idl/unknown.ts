/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/unknown.json`.
 */
export type Unknown = {
  "address": "2X5DHDfcqKLisg7ss6s7FLpUEr2B48ax73EKRgYGWiTW",
  "metadata": {
    "name": "unknown",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Unknown — a Solana launchpad where fate decides what the dev can dump"
  },
  "instructions": [
    {
      "name": "buy",
      "discriminator": [
        102,
        6,
        61,
        18,
        1,
        218,
        235,
        234
      ],
      "accounts": [
        {
          "name": "trader",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "feeRecipient",
          "writable": true
        },
        {
          "name": "launch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "relations": [
            "launch"
          ]
        },
        {
          "name": "solVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "devVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "holderPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "curveTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "launch"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "traderTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "trader"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "solAmount",
          "type": "u64"
        },
        {
          "name": "minTokensOut",
          "type": "u64"
        }
      ]
    },
    {
      "name": "claimDevFees",
      "discriminator": [
        146,
        98,
        56,
        128,
        107,
        210,
        44,
        41
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true,
          "relations": [
            "devVault"
          ]
        },
        {
          "name": "launch",
          "relations": [
            "devVault"
          ]
        },
        {
          "name": "devVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "launch.mint",
                "account": "launch"
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "claimHolderReward",
      "discriminator": [
        51,
        163,
        15,
        252,
        248,
        154,
        190,
        46
      ],
      "accounts": [
        {
          "name": "holder",
          "writable": true,
          "signer": true
        },
        {
          "name": "launch",
          "relations": [
            "holderPool"
          ]
        },
        {
          "name": "holderPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "launch.mint",
                "account": "launch"
              }
            ]
          }
        },
        {
          "name": "epoch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  112,
                  111,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "holderPool"
              },
              {
                "kind": "arg",
                "path": "index"
              }
            ]
          }
        },
        {
          "name": "receipt",
          "docs": [
            "`init` fails if it exists, so each holder claims each epoch once."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  108,
                  97,
                  105,
                  109
                ]
              },
              {
                "kind": "account",
                "path": "epoch"
              },
              {
                "kind": "account",
                "path": "holder"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "index",
          "type": "u32"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "proof",
          "type": {
            "vec": {
              "array": [
                "u8",
                32
              ]
            }
          }
        }
      ]
    },
    {
      "name": "createLaunch",
      "docs": [
        "Creates the token with authorities burned, escrows the dev buy and rolls the dice."
      ],
      "discriminator": [
        239,
        223,
        255,
        134,
        39,
        121,
        127,
        62
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "mint",
          "docs": [
            "Fresh keypair. Freeze authority is never set; mint authority is revoked below."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "launch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "solVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "devVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "holderPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "curveTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "launch"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "devVault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vrfProgram"
        },
        {
          "name": "vrfNetworkState",
          "writable": true
        },
        {
          "name": "vrfTreasury",
          "writable": true
        },
        {
          "name": "randomness",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "symbol",
          "type": "string"
        },
        {
          "name": "uri",
          "type": "string"
        },
        {
          "name": "devBuyLamports",
          "type": "u64"
        }
      ]
    },
    {
      "name": "fogRequest",
      "docs": [
        "Draws randomness for the next fog tick."
      ],
      "discriminator": [
        145,
        2,
        133,
        174,
        137,
        50,
        244,
        49
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "launch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "launch.mint",
                "account": "launch"
              }
            ]
          }
        },
        {
          "name": "vrfProgram"
        },
        {
          "name": "vrfNetworkState",
          "writable": true
        },
        {
          "name": "vrfTreasury",
          "writable": true
        },
        {
          "name": "randomness",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "fogResolve",
      "docs": [
        "Reveals whether this tick lifts the fog and opens trading."
      ],
      "discriminator": [
        189,
        253,
        171,
        119,
        98,
        178,
        228,
        76
      ],
      "accounts": [
        {
          "name": "launch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "launch.mint",
                "account": "launch"
              }
            ]
          }
        },
        {
          "name": "devVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "launch.mint",
                "account": "launch"
              }
            ]
          }
        },
        {
          "name": "randomness"
        }
      ],
      "args": []
    },
    {
      "name": "graduate",
      "docs": [
        "Migrates a completed curve into Raydium CPMM and burns the LP."
      ],
      "discriminator": [
        45,
        235,
        225,
        181,
        17,
        218,
        64,
        130
      ],
      "accounts": [
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "feeRecipient",
          "writable": true
        },
        {
          "name": "launch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "writable": true,
          "relations": [
            "launch"
          ]
        },
        {
          "name": "curveTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "launch"
              },
              {
                "kind": "account",
                "path": "token2022Program"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "solVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "solVault"
              },
              {
                "kind": "account",
                "path": "token2022Program"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "wsolMint",
          "address": "So11111111111111111111111111111111111111112"
        },
        {
          "name": "vaultWsolAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "solVault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "wsolMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "cpmmProgram"
        },
        {
          "name": "ammConfig"
        },
        {
          "name": "cpmmAuthority"
        },
        {
          "name": "poolState",
          "writable": true
        },
        {
          "name": "lpMint",
          "writable": true
        },
        {
          "name": "vaultLpAccount",
          "writable": true
        },
        {
          "name": "token0Vault",
          "writable": true
        },
        {
          "name": "token1Vault",
          "writable": true
        },
        {
          "name": "createPoolFee",
          "writable": true
        },
        {
          "name": "observationState",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "token2022Program",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeConfig",
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "configParams"
            }
          }
        }
      ]
    },
    {
      "name": "mockFulfill",
      "docs": [
        "Local validators only (`mock-vrf` builds): injects VRF output."
      ],
      "discriminator": [
        42,
        148,
        109,
        157,
        249,
        42,
        105,
        3
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "randomness",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  111,
                  99,
                  107,
                  118,
                  114,
                  102
                ]
              },
              {
                "kind": "arg",
                "path": "seed"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "seed",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "randomness",
          "type": {
            "array": [
              "u8",
              64
            ]
          }
        }
      ]
    },
    {
      "name": "postHolderEpoch",
      "discriminator": [
        227,
        231,
        95,
        200,
        158,
        217,
        81,
        6
      ],
      "accounts": [
        {
          "name": "merkleAuthority",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "holderPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "launch.mint",
                "account": "launch"
              }
            ]
          }
        },
        {
          "name": "launch",
          "relations": [
            "holderPool"
          ]
        },
        {
          "name": "epoch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  112,
                  111,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "holderPool"
              },
              {
                "kind": "account",
                "path": "holder_pool.epoch_count",
                "account": "holderPool"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "total",
          "type": "u64"
        },
        {
          "name": "root",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "snapshotSlot",
          "type": "u64"
        }
      ]
    },
    {
      "name": "refundLaunch",
      "docs": [
        "Refunds the dev if the dice VRF never answered."
      ],
      "discriminator": [
        19,
        136,
        118,
        23,
        225,
        75,
        11,
        125
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true
        },
        {
          "name": "launch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "launch.mint",
                "account": "launch"
              }
            ]
          }
        },
        {
          "name": "solVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "launch.mint",
                "account": "launch"
              }
            ]
          }
        },
        {
          "name": "randomness"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "sell",
      "discriminator": [
        51,
        230,
        133,
        164,
        1,
        127,
        131,
        173
      ],
      "accounts": [
        {
          "name": "trader",
          "writable": true,
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "feeRecipient",
          "writable": true
        },
        {
          "name": "launch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "relations": [
            "launch"
          ]
        },
        {
          "name": "solVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "devVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "holderPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "curveTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "launch"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "traderTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "trader"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "tokenAmount",
          "type": "u64"
        },
        {
          "name": "minSolOut",
          "type": "u64"
        }
      ]
    },
    {
      "name": "settleLaunch",
      "docs": [
        "Lands the dice: executes the dev buy and splits it into free and bound tokens."
      ],
      "discriminator": [
        200,
        143,
        23,
        151,
        91,
        142,
        43,
        125
      ],
      "accounts": [
        {
          "name": "cranker",
          "signer": true
        },
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "feeRecipient",
          "writable": true
        },
        {
          "name": "creator",
          "writable": true
        },
        {
          "name": "launch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "relations": [
            "launch"
          ]
        },
        {
          "name": "solVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  111,
                  108,
                  95,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "devVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "holderPool",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  111,
                  111,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "curveTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "launch"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "devVault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "randomness"
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "updateConfig",
      "discriminator": [
        29,
        158,
        252,
        191,
        10,
        83,
        219,
        99
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "params",
          "type": {
            "defined": {
              "name": "configParams"
            }
          }
        },
        {
          "name": "newAdmin",
          "type": {
            "option": "pubkey"
          }
        }
      ]
    },
    {
      "name": "withdrawFromVault",
      "discriminator": [
        180,
        34,
        37,
        46,
        156,
        0,
        211,
        238
      ],
      "accounts": [
        {
          "name": "creator",
          "writable": true,
          "signer": true,
          "relations": [
            "devVault"
          ]
        },
        {
          "name": "launch",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  97,
                  117,
                  110,
                  99,
                  104
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "mint",
          "relations": [
            "launch"
          ]
        },
        {
          "name": "devVault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ]
          }
        },
        {
          "name": "vaultTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "devVault"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "creatorTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "account",
                "path": "tokenProgram"
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "claimReceipt",
      "discriminator": [
        223,
        233,
        11,
        229,
        124,
        165,
        207,
        28
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "devVault",
      "discriminator": [
        45,
        191,
        51,
        163,
        222,
        84,
        38,
        127
      ]
    },
    {
      "name": "holderEpoch",
      "discriminator": [
        236,
        95,
        88,
        138,
        150,
        236,
        214,
        123
      ]
    },
    {
      "name": "holderPool",
      "discriminator": [
        145,
        79,
        18,
        222,
        226,
        163,
        196,
        46
      ]
    },
    {
      "name": "launch",
      "discriminator": [
        144,
        51,
        51,
        163,
        206,
        85,
        213,
        38
      ]
    },
    {
      "name": "mockRandomness",
      "discriminator": [
        178,
        216,
        41,
        24,
        156,
        153,
        7,
        104
      ]
    }
  ],
  "events": [
    {
      "name": "curveComplete",
      "discriminator": [
        121,
        172,
        68,
        248,
        143,
        231,
        180,
        42
      ]
    },
    {
      "name": "devFeesClaimed",
      "discriminator": [
        31,
        40,
        18,
        11,
        243,
        101,
        75,
        23
      ]
    },
    {
      "name": "diceRolled",
      "discriminator": [
        7,
        111,
        244,
        16,
        252,
        210,
        24,
        250
      ]
    },
    {
      "name": "fogRequested",
      "discriminator": [
        218,
        175,
        249,
        11,
        150,
        173,
        87,
        205
      ]
    },
    {
      "name": "fogResolved",
      "discriminator": [
        202,
        172,
        59,
        185,
        36,
        236,
        94,
        139
      ]
    },
    {
      "name": "graduated",
      "discriminator": [
        51,
        241,
        66,
        50,
        140,
        245,
        156,
        192
      ]
    },
    {
      "name": "holderEpochPosted",
      "discriminator": [
        179,
        87,
        132,
        131,
        157,
        186,
        237,
        232
      ]
    },
    {
      "name": "holderRewardClaimed",
      "discriminator": [
        38,
        51,
        8,
        24,
        30,
        110,
        96,
        202
      ]
    },
    {
      "name": "launchCreated",
      "discriminator": [
        59,
        38,
        190,
        230,
        33,
        34,
        89,
        20
      ]
    },
    {
      "name": "launchRefunded",
      "discriminator": [
        191,
        140,
        2,
        235,
        250,
        185,
        29,
        220
      ]
    },
    {
      "name": "trade",
      "discriminator": [
        24,
        254,
        218,
        152,
        253,
        43,
        18,
        81
      ]
    },
    {
      "name": "vaultWithdrawn",
      "discriminator": [
        238,
        9,
        219,
        172,
        188,
        77,
        72,
        104
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "paused",
      "msg": "Protocol is paused"
    },
    {
      "code": 6001,
      "name": "mathOverflow",
      "msg": "Math overflow"
    },
    {
      "code": 6002,
      "name": "invalidConfig",
      "msg": "Invalid config parameters"
    },
    {
      "code": 6003,
      "name": "metadataTooLong",
      "msg": "Name, symbol or uri too long"
    },
    {
      "code": 6004,
      "name": "devBuyOutOfRange",
      "msg": "Dev buy is outside the allowed range"
    },
    {
      "code": 6005,
      "name": "invalidState",
      "msg": "Launch is not in the required state"
    },
    {
      "code": 6006,
      "name": "wrongRandomnessAccount",
      "msg": "Randomness account does not match the pending request"
    },
    {
      "code": 6007,
      "name": "randomnessNotReady",
      "msg": "Randomness has not been fulfilled yet"
    },
    {
      "code": 6008,
      "name": "noPendingRequest",
      "msg": "No randomness request is pending"
    },
    {
      "code": 6009,
      "name": "requestAlreadyPending",
      "msg": "A randomness request is already pending"
    },
    {
      "code": 6010,
      "name": "tooEarly",
      "msg": "Too early"
    },
    {
      "code": 6011,
      "name": "notTimedOut",
      "msg": "VRF request has not timed out yet"
    },
    {
      "code": 6012,
      "name": "slippageExceeded",
      "msg": "Slippage tolerance exceeded"
    },
    {
      "code": 6013,
      "name": "zeroAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6014,
      "name": "curveSoldOut",
      "msg": "Curve has no tokens left"
    },
    {
      "code": 6015,
      "name": "insufficientCurveSol",
      "msg": "Not enough SOL in the curve"
    },
    {
      "code": 6016,
      "name": "exceedsUnlocked",
      "msg": "Amount exceeds the unlocked vault balance"
    },
    {
      "code": 6017,
      "name": "nothingToClaim",
      "msg": "Nothing to claim"
    },
    {
      "code": 6018,
      "name": "exceedsUnallocated",
      "msg": "Epoch total exceeds unallocated holder pool"
    },
    {
      "code": 6019,
      "name": "invalidProof",
      "msg": "Invalid merkle proof"
    },
    {
      "code": 6020,
      "name": "epochExhausted",
      "msg": "Epoch has insufficient remaining balance"
    },
    {
      "code": 6021,
      "name": "wrongDexProgram",
      "msg": "Wrong DEX program"
    },
    {
      "code": 6022,
      "name": "wrongMintOrder",
      "msg": "Wrong mint ordering for pool"
    },
    {
      "code": 6023,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6024,
      "name": "mockVrfDisabled",
      "msg": "Mock VRF is not enabled in this build"
    }
  ],
  "types": [
    {
      "name": "claimReceipt",
      "docs": [
        "Its existence marks (epoch, holder) as claimed."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "epoch",
            "type": "pubkey"
          },
          {
            "name": "holder",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "feeRecipient",
            "type": "pubkey"
          },
          {
            "name": "merkleAuthority",
            "docs": [
              "Posts holder-reward merkle roots (the indexer's key)."
            ],
            "type": "pubkey"
          },
          {
            "name": "cpmmProgram",
            "docs": [
              "Raydium CPMM program the curve graduates into."
            ],
            "type": "pubkey"
          },
          {
            "name": "protocolFeeBps",
            "type": "u16"
          },
          {
            "name": "creatorFeeBps",
            "type": "u16"
          },
          {
            "name": "initialVirtualSol",
            "type": "u64"
          },
          {
            "name": "initialVirtualTokens",
            "type": "u64"
          },
          {
            "name": "curveSupply",
            "docs": [
              "Tokens sold on the curve; the curve completes when they are gone."
            ],
            "type": "u64"
          },
          {
            "name": "lpSupply",
            "docs": [
              "Tokens reserved for the DEX pool at graduation."
            ],
            "type": "u64"
          },
          {
            "name": "minDevBuy",
            "type": "u64"
          },
          {
            "name": "maxDevBuy",
            "type": "u64"
          },
          {
            "name": "fogTickSecs",
            "type": "i64"
          },
          {
            "name": "fogMaxTicks",
            "type": "u8"
          },
          {
            "name": "vrfTimeoutSecs",
            "type": "i64"
          },
          {
            "name": "migrationFee",
            "docs": [
              "Lamports sent to `fee_recipient` at graduation."
            ],
            "type": "u64"
          },
          {
            "name": "migrationBudget",
            "docs": [
              "Lamports handed to the migrator PDA to pay DEX pool rent and fees."
            ],
            "type": "u64"
          },
          {
            "name": "paused",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "configParams",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feeRecipient",
            "type": "pubkey"
          },
          {
            "name": "merkleAuthority",
            "type": "pubkey"
          },
          {
            "name": "cpmmProgram",
            "type": "pubkey"
          },
          {
            "name": "protocolFeeBps",
            "type": "u16"
          },
          {
            "name": "creatorFeeBps",
            "type": "u16"
          },
          {
            "name": "initialVirtualSol",
            "type": "u64"
          },
          {
            "name": "initialVirtualTokens",
            "type": "u64"
          },
          {
            "name": "curveSupply",
            "type": "u64"
          },
          {
            "name": "lpSupply",
            "type": "u64"
          },
          {
            "name": "minDevBuy",
            "type": "u64"
          },
          {
            "name": "maxDevBuy",
            "type": "u64"
          },
          {
            "name": "fogTickSecs",
            "type": "i64"
          },
          {
            "name": "fogMaxTicks",
            "type": "u8"
          },
          {
            "name": "vrfTimeoutSecs",
            "type": "i64"
          },
          {
            "name": "migrationFee",
            "type": "u64"
          },
          {
            "name": "migrationBudget",
            "type": "u64"
          },
          {
            "name": "paused",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "curveComplete",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "realSol",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "devFeesClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "devVault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "launch",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "liquidTotal",
            "docs": [
              "Freed by the dice: withdrawable at any time."
            ],
            "type": "u64"
          },
          {
            "name": "vestTotal",
            "docs": [
              "Bound by the dice: unlocks linearly from `vest_start` over 3 hours."
            ],
            "type": "u64"
          },
          {
            "name": "vestStart",
            "docs": [
              "0 until trading opens."
            ],
            "type": "i64"
          },
          {
            "name": "withdrawn",
            "type": "u64"
          },
          {
            "name": "staked",
            "docs": [
              "Tokens currently held by the vault. Only these count."
            ],
            "type": "u64"
          },
          {
            "name": "peak",
            "docs": [
              "Highest `staked` ever. Never grows after the dev buy."
            ],
            "type": "u64"
          },
          {
            "name": "coefBps",
            "docs": [
              "Share of creator fees the dev keeps, in bps. Only ever decreases."
            ],
            "type": "u16"
          },
          {
            "name": "feeClaimable",
            "type": "u64"
          },
          {
            "name": "feeClaimed",
            "type": "u64"
          },
          {
            "name": "feeForfeited",
            "docs": [
              "Creator fees redirected to holders because `coef_bps` < 100%."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "diceRolled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "d1",
            "type": "u8"
          },
          {
            "name": "d2",
            "type": "u8"
          },
          {
            "name": "liquidBps",
            "type": "u16"
          },
          {
            "name": "devTokens",
            "type": "u64"
          },
          {
            "name": "liquidTokens",
            "type": "u64"
          },
          {
            "name": "vestingTokens",
            "type": "u64"
          },
          {
            "name": "solSpent",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "fogRequested",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "tick",
            "type": "u8"
          },
          {
            "name": "vrfSeed",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "fogResolved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "tick",
            "type": "u8"
          },
          {
            "name": "opened",
            "type": "bool"
          },
          {
            "name": "forced",
            "type": "bool"
          },
          {
            "name": "nextTickAt",
            "type": "i64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "graduated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "solLiquidity",
            "type": "u64"
          },
          {
            "name": "tokenLiquidity",
            "type": "u64"
          },
          {
            "name": "lpBurned",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "holderEpoch",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u32"
          },
          {
            "name": "root",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "total",
            "type": "u64"
          },
          {
            "name": "claimed",
            "type": "u64"
          },
          {
            "name": "snapshotSlot",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "holderEpochPosted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u32"
          },
          {
            "name": "root",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "total",
            "type": "u64"
          },
          {
            "name": "snapshotSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "holderPool",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "launch",
            "type": "pubkey"
          },
          {
            "name": "totalReceived",
            "type": "u64"
          },
          {
            "name": "totalAllocated",
            "type": "u64"
          },
          {
            "name": "totalClaimed",
            "type": "u64"
          },
          {
            "name": "epochCount",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "holderRewardClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "index",
            "type": "u32"
          },
          {
            "name": "holder",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "launch",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "state",
            "type": {
              "defined": {
                "name": "launchState"
              }
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "virtualSol",
            "type": "u64"
          },
          {
            "name": "virtualTokens",
            "type": "u64"
          },
          {
            "name": "realSol",
            "type": "u64"
          },
          {
            "name": "realTokens",
            "docs": [
              "Tokens still for sale on the curve."
            ],
            "type": "u64"
          },
          {
            "name": "lpTokens",
            "type": "u64"
          },
          {
            "name": "devBuyEscrow",
            "docs": [
              "Held in `sol_vault` (with `real_sol` and a rent reserve) until settle."
            ],
            "type": "u64"
          },
          {
            "name": "d1",
            "type": "u8"
          },
          {
            "name": "d2",
            "type": "u8"
          },
          {
            "name": "liquidBps",
            "type": "u16"
          },
          {
            "name": "vrfSeed",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "vrfPending",
            "type": "bool"
          },
          {
            "name": "vrfRequestedAt",
            "type": "i64"
          },
          {
            "name": "fogTick",
            "type": "u8"
          },
          {
            "name": "nextTickAt",
            "type": "i64"
          },
          {
            "name": "fogDeadline",
            "docs": [
              "After this, anyone may force the fog open (liveness if nobody cranks)."
            ],
            "type": "i64"
          },
          {
            "name": "openedAt",
            "type": "i64"
          },
          {
            "name": "completedAt",
            "type": "i64"
          },
          {
            "name": "graduatedAt",
            "type": "i64"
          },
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "volumeSol",
            "type": "u64"
          },
          {
            "name": "protocolFeeBps",
            "type": "u16"
          },
          {
            "name": "creatorFeeBps",
            "type": "u16"
          },
          {
            "name": "fogTickSecs",
            "type": "i64"
          },
          {
            "name": "fogMaxTicks",
            "type": "u8"
          },
          {
            "name": "vrfTimeoutSecs",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "solVaultBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "launchCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "symbol",
            "type": "string"
          },
          {
            "name": "uri",
            "type": "string"
          },
          {
            "name": "devBuyLamports",
            "type": "u64"
          },
          {
            "name": "vrfSeed",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "launchRefunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "launchState",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "rolling"
          },
          {
            "name": "fogged"
          },
          {
            "name": "trading"
          },
          {
            "name": "complete"
          },
          {
            "name": "graduated"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    },
    {
      "name": "mockRandomness",
      "docs": [
        "Admin-injected randomness for local testing (`mock-vrf` builds only)."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "seed",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "randomness",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "trade",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "trader",
            "type": "pubkey"
          },
          {
            "name": "isBuy",
            "type": "bool"
          },
          {
            "name": "solAmount",
            "type": "u64"
          },
          {
            "name": "tokenAmount",
            "type": "u64"
          },
          {
            "name": "protocolFee",
            "type": "u64"
          },
          {
            "name": "devFee",
            "type": "u64"
          },
          {
            "name": "holderFee",
            "type": "u64"
          },
          {
            "name": "virtualSol",
            "type": "u64"
          },
          {
            "name": "virtualTokens",
            "type": "u64"
          },
          {
            "name": "realSol",
            "type": "u64"
          },
          {
            "name": "realTokens",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "vaultWithdrawn",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "staked",
            "type": "u64"
          },
          {
            "name": "peak",
            "type": "u64"
          },
          {
            "name": "coefBps",
            "type": "u16"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
