const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Random IPFS NFT Unit Tests", function () {
          let randomIpfsNft, deployer

          beforeEach(async () => {
              accounts = await ethers.getSigners()
              deployer = accounts[0]
              await deployments.fixture(["mocks", "randomipfs"])
              randomIpfsNft = await ethers.getContract("RandomIpfsNft")
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
          })

          describe("constructor", function () {
              it("sets the initial values correctly", async function () {
                  const dogTokenUriZero = await randomIpfsNft.getDogTokenUris(0)
                  const isInitialized = await randomIpfsNft.getInitialized()
                  assert(dogTokenUriZero.includes("ipfs://"))
                  assert(isInitialized)
              })
          })

          describe("requestNft", function () {
              it("falls if payment isn't sent with enough ETH", async function () {
                  const fee = (await randomIpfsNft.getMintFee()).toString() - 100

                  await expect(
                      randomIpfsNft.requestNft({
                          value: fee.toString(),
                      })
                  ).to.be.revertedWith("RandomIpfsNft__NeedMoreETHSent")
              })

              it("checks if request Id is correctly assigned to true owner", async function () {
                  const fee = (await randomIpfsNft.getMintFee()).toString()
                  const tx = await randomIpfsNft.requestNft({
                      value: fee,
                  })
                  const txReceipt = await tx.wait(1)
                  const dogOwner = await randomIpfsNft.s_requestIdToSender(
                      txReceipt.events[1].args.requestId
                  )
                  assert.equal(dogOwner, deployer.address)
              })

              it("emits event and kicks off a random word request", async function () {
                  const fee = await randomIpfsNft.getMintFee()
                  expect(
                      await randomIpfsNft.requestNft({
                          value: fee.toString(),
                      })
                  ).to.emit(randomIpfsNft, "NftRequested")
              })
          })

          describe("fulfillRandomWords", async function () {
              it("mints NFT after random number is obtained", async function () {
                  await new Promise(async (resolve, reject) => {
                      randomIpfsNft.once("NftMinted", async () => {
                          try {
                              const tokenUri = await randomIpfsNft.getDogTokenUris(0)
                              const tokenCounter = await randomIpfsNft.getTokenCounter()
                              assert(tokenUri.toString().includes("ipfs://"))
                              assert.equal(tokenCounter, "1")
                              resolve()
                          } catch (e) {
                              console.log(e)
                              reject(e)
                          }
                          try {
                              const fee = await randomIpfsNft.getMintFee()
                              const requestNftResponse = await randomIpfsNft.requestNft({
                                  value: fee.toString(),
                              })
                              const requestNftReceipt = await requestNftResponse.wait(1)
                              await vrfCoordinatorV2Mock.fulfillRandomWords(
                                  requestNftReceipt.events[1].args.requestId,
                                  randomIpfsNft.address
                              )
                          } catch (e) {
                              console.log(e)
                              reject(e)
                          }
                      })
                  })
              })
          })
      })
