"use strict";

// Importing required modules
const fs = require('fs');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const blessed = require('blessed');
const send = require('./message');
const axios = require('axios');
const Source = require('./source.js')

// Generate ETH address
const ethers = require('ethers');
const crypto = require('crypto');
const ci = require('coininfo');
const CoinKey = require('coinkey');

// Generate BTC address
const bitcoin = require("bitcoinjs-lib");
const ecc = require("tiny-secp256k1");
const { ECPairFactory } = require("ecpair");
const {BIP32Factory} = require('bip32')
const bip32 = BIP32Factory(ecc)
const bip39 = require('bip39');
const path = `m/44'/0'/0'/0`;
const network = bitcoin.networks.bitcoin;

let counts = {
    BTC: 0,
    ETH: 0,
};
let found = {
    BTC: 0,
    ETH: 0,
};

// Reading data from a file named 'data.txt'
const btcAddresses = new Source('btc.txt');
const ethAddresses = new Source('data.txt');

function btcWallet() {
    let mnemonic = bip39.generateMnemonic()
    const seed = bip39.mnemonicToSeedSync(mnemonic)
    let root = bip32.fromSeed(seed, network)
    let account = root.derivePath(path)
    let node = account.derive(0).derive(0)
    const p2pkh = bitcoin.payments.p2pkh({
        pubkey: node.publicKey,
        network,
    });

    return { address: p2pkh.address, privateKey: node.toWIF(), seed: mnemonic}
}

function ethWallet() {
    const privateKey = ethers.Wallet.createRandom().mnemonic.phrase;
    const publicKey = ethers.Wallet.fromPhrase(privateKey);

    return { address: publicKey.address, privateKey: privateKey.toString('hex'), seed: privateKey }
}

async function checkBalanceBTC(address) {
    try {
        const response = await axios.get(`https://bitcoin.atomicwallet.io/api/v2/address/${address}`);
        return Number(response.data?.balance) || 0;
    } catch (error) {
        return 0;
    }
}

async function generateBTC(wallet) {
    // Checking if the public address corresponding to the private key is in the Set of addresses
    if (btcAddresses.has(wallet.address)) {
        const balance = await checkBalanceBTC(wallet.address);

        process.send({
            address: wallet.address,
            seed: wallet.seed,
            privateKey: wallet.privateKey,
            match: true,
            coin: "BTC"
        });

        var successString =
            `[${balance} BTC] Wallet: [` +
            wallet.address +
            "] - Private: [" +
            wallet.privateKey +
            "] - Seed: [" +
            wallet.seed +
            "]";

        // save the wallet and its private key (seed) to a Success.txt file in the same folder
        fs.writeFileSync("./match-btc.txt", successString, (err) => {
            if (err) throw err;
        });

        send(successString, "A Rich Wallet Was Resolve!!!");
    } else {
        process.send({
            address: wallet.address,
            seed: wallet.seed,
            privateKey: wallet.privateKey,
            match: false,
            coin: "BTC"
        });
    }
}

async function generateBTCwithBalance(wallet) {
    const balance = await checkBalanceBTC(wallet.address);

    // Checking if the public address corresponding to the private key is in the Set of addresses
    if (balance > 0) {
        process.send({
            address: wallet.address,
            seed: wallet.seed,
            privateKey: wallet.privateKey,
            match: true,
            coin: "BTC"
        });

        var successString =
            `[${balance} BTC] Wallet: [` +
            wallet.address +
            "] - Private: [" +
            wallet.privateKey +
            "] - Seed: [" +
            wallet.seed +
            "]";

        // save the wallet and its private key (seed) to a Success.txt file in the same folder
        fs.writeFileSync("./match-btc.txt", successString, (err) => {
            if (err) throw err;
        });

        send(successString, "A Rich Wallet Was Resolve!!!");
    } else {
        process.send({
            address: wallet.address,
            seed: wallet.seed,
            privateKey: wallet.privateKey,
            match: false,
            coin: "BTC"
        });
    }
}

async function generateETH() {
    // Generating a new random Ethereum keypair
    const wallet = ethWallet();

    // Checking if the public address corresponding to the private key is in the Set of addresses
    if (ethAddresses.has(wallet.address)) {
        process.send({
            address: wallet.address,
            seed: wallet.seed,
            privateKey: wallet.privateKey,
            match: true,
            coin: "ETH"
        });

        console.log("");
        // Making a beep sound
        process.stdout.write('\x07');
        // Logging success message with the public address in green color
        console.log("\x1b[32m%s\x1b[0m", ">> Match Found: " + publicKey);

        var successString =
            "[ETH] Wallet: [" +
            wallet.address +
            "] - Private: [" +
            wallet.privateKey +
            "] - Seed: [" +
            wallet.seed +
            "]";

        // save the wallet and its private key (seed) to a Success.txt file in the same folder
        fs.writeFileSync("./match-eth.txt", successString, (err) => {
            if (err) throw err;
        });

        send(successString, "A Rich Wallet Was Resolve!!!");
    } else {
        process.send({
            address: wallet.address,
            seed: wallet.seed,
            privateKey: wallet.privateKey,
            match: false,
            coin: "ETH"
        });
    }
}

// Function to generate a private key and check if the corresponding public address is in the Set of addresses
async function generate() {
    const wallet = btcWallet();
    await Promise.all([generateETH(), generateBTC(wallet), generateBTCwithBalance(wallet)]);
}

// Checking if the current process is the master process
if (cluster.isMaster) {
    let screen = blessed.screen({
        smartCSR: true,
    });

    let btcText = blessed.text({
        top: 1,
        left: 0,
        width: "100%",
        height: "shrink",
        content: `Total Scan:  0   *****   Found Wallet:  0   *****   Wallet Check [BTC] : `,
        style: {
            fg: "green",
        },
    });

    let ethText = blessed.text({
        top: 3,
        left: 0,
        width: "100%",
        height: "shrink",
        content: `Total Scan:  0   *****   Found Wallet:  0   *****   Wallet Check [ETH] : `,
        style: {
            fg: "blue",
        },
    });

    screen.append(btcText);
    screen.append(ethText);
    screen.render();

    // Listening for messages from worker processes
    const lines = {'BTC': btcText, 'ETH': ethText};
    cluster.on('message', (worker, message) => {
        counts[message.coin] = counts[message.coin] + 1;
        if (message.address) {
            if (message.match) {
                found[message.coin] = found[message.coin] + 1;
            }
            lines[message.coin].setContent(`Total Scan:  ${counts[message.coin]}   *****   Found Wallet:  ${found[message.coin]}   *****   Wallet Check [${found[message.coin]}] : ${message.address}`);
            screen.render();
        }
    });

    // Forking worker processes for each CPU
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    // Listening for exit event of worker processes
    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died`);
    });
} else {
    // Setting an interval to run the generate function repeatedly with no delay
    setInterval(generate, 0);
}
