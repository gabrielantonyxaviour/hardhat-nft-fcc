const { network } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deployer } = await getNamedAccounts()
    const { deploy, log } = deployments

    log("---------------------------------")
    const args = []
    const basicNFT = await deploy("BasicNFT", {
        from: deployer,
        args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying BasicNFT contract...")
        await verify(basicNFT.address, args)
        log("----------------------")
    }
}
module.exports.tags = ["all", "main", "basicnft"]
