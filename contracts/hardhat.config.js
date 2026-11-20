require('@nomicfoundation/hardhat-toolbox');

const PK = process.env.DEPLOYER_PRIVATE_KEY;
module.exports = {
  solidity: {
    version: '0.8.24',
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris' },
  },
  networks: {
    bscTestnet: { url: process.env.BSC_TESTNET_RPC || 'https://data-seed-prebsc-1-s1.bnbchain.org:8545', chainId: 97, accounts: PK ? [PK] : [] },
    bsc: { url: process.env.BSC_RPC || 'https://bsc-dataseed.bnbchain.org', chainId: 56, accounts: PK ? [PK] : [] },
  },
  etherscan: { apiKey: process.env.BSCSCAN_API_KEY || '' },
};
