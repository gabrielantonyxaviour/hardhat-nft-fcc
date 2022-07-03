const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")
const { storeImages, storeTokenUriMetadata } = require("../utils/uploadToPinata")

const imagesLocation = "./images/randomNft"
const tokenUris = [
    "ipfs://QmUjqUoSeG5eqkDUj7j1QJRZCbcrRRnGAR4DFsVZeKQHZd",
    "ipfs://QmcFs4w2g7VdfXz9FV9qMrtwJnJMnJXUh2wspRHxFx53cz",
    "ipfs://QmdFSUoyNe5GLrFX9LB3ftRfD97fmGhePCXcFXZnS5ZmyX",
]
const metadataTemplate = {
    name: "",
    description: "",
    image: "",
    attributes: [
        {
            trait_type: "Cuteness",
            value: 100,
        },
        {
            trait_type: "Rarity",
            value: 1,
        },
    ],
}
const FUND_AMOUNT = "100000000000000000000"

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deployer } = await getNamedAccounts()
    const { deploy, log } = deployments

    const { chainId } = network.config

    if (process.env.UPLOAD_TO_PINATA == "true") {
        tokenUris = await handleTokenURIs()
    }

    let vrfCoordinatorV2Address, subscriptionId

    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        const tx = await vrfCoordinatorV2Mock.createSubscription()
        const txReceipt = await tx.wait(1)
        subscriptionId = txReceipt.events[0].args.subId
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2
        subscriptionId = networkConfig[chainId].subscriptionId
    }

    log("------------------------")
    const args = [
        vrfCoordinatorV2Address,
        networkConfig[chainId].gasLane,
        subscriptionId,
        networkConfig[chainId].callbackGasLimit,
        tokenUris,
        networkConfig[chainId].mintFee,
    ]
    const RandomIpfsNft = await deploy("RandomIpfsNft", {
        from: deployer,
        args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying BasicNFT contract...")
        await verify(RandomIpfsNft.address, args)
        log("----------------------")
    }
}

async function handleTokenURIs() {
    tokenUris = []
    const { responses: imageUploadResponses, files } = await storeImages(imagesLocation)
    for (imageUploadResponseIndex in imageUploadResponses) {
        let tokenUriMetadata = { ...metadataTemplate }
        tokenUriMetadata.name = files[imageUploadResponseIndex].replace(".png", "")
        tokenUriMetadata.description = `An adorable ${tokenUriMetadata.name} pup!`
        tokenUriMetadata.image = `ipfs://${imageUploadResponses[imageUploadResponseIndex].IpfsHash}`
        console.log(`Uploading ${tokenUriMetadata.name}...`)
        const metadataUploadResponse = await storeTokenUriMetadata(tokenUriMetadata)
        tokenUris.push(`ipfs://${metadataUploadResponse.IpfsHash}`)
    }
    console.log("Token URIs uploaded! They are:")
    console.log(tokenUris)
    return tokenUris
}
module.exports.tags = ["all", "randomipfs", "main"]
