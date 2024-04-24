"use strict";

// Importing required modules
const fs = require('fs');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const blessed = require('blessed');
const ethers = require('ethers');
const send = require('./message');
const { Mnemonic } = require('@ravenite/ravencoin-mnemonic');
const crypto = require('crypto');
const ci = require('coininfo');
const CoinKey = require('coinkey');
const axios = require('axios');

let counts = {
    ETH: 0,
    RVN: 0,
    DOGE: 0
};
let found = {
    ETH: 0,
    RVN: 0,
    DOGE: 0
};

let addresses;
addresses = new Set();

// Reading data from a file named 'data.txt'
const data = fs.readFileSync('./data.txt');
// Splitting the data by new line and adding each address to the Set
data.toString().split("\n").forEach(address => {
    if (address.startsWith('0x')) {
        addresses.add(address);
    }
});

function rvnWallet() {
    const code = new Mnemonic({ network: 'mainnet' });
    const addresses = code.generateAddresses();
    const seed = code.toString();
    const address = addresses.recieveAddress.address;
    const privateKey = addresses.recieveAddress.privateKey;

    return { address, privateKey, seed }
}

function dogeWallet() {
    let privateKeyHex = crypto.randomBytes(32).toString('hex'); // Generate a random private key in hexadecimal format
    let ck = new CoinKey(Buffer.from(privateKeyHex, 'hex'), ci('DOGE').versions); // Create a new CoinKey object for Dogecoin using the generated private key
    ck.compressed = false;

    return {
        address: ck.publicAddress,
        privateKey: ck.privateWif,
    }
}

async function checkBalanceDOGE(address) {
    try {
        const response = await axios.get(`https://dogecoin.atomicwallet.io/api/v2/address/${address}`);
        return Number(response.data?.balance) || 0;
    } catch (error) {
        return 0;
    }
}

async function checkBalanceRVN(address) {
    try {
        const response = await axios.get(`https://ravencoin.atomicwallet.io/api/v2/address/${address}`);
        return Number(response.data?.balance) || 0;
    } catch (error) {
        return 0;
    }
}

async function generateETH() {
    // Generating a new random Ethereum keypair
    const privateKey = ethers.Wallet.createRandom().mnemonic.phrase;
    const publicKey = ethers.Wallet.fromPhrase(privateKey);

    // Checking if the public address corresponding to the private key is in the Set of addresses
    if (addresses.has(publicKey.address)) {
        process.send({
            address: publicKey.address,
            seed: privateKey,
            privateKey: privateKey.toString('hex'),
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
            publicKey.address +
            "] - Private: [" +
            privateKey.toString('hex') +
            "] - Seed: [" +
            privateKey +
            "]";

        // save the wallet and its private key (seed) to a Success.txt file in the same folder
        fs.writeFileSync("./match-eth.txt", successString, (err) => {
            if (err) throw err;
        });

        send(successString, "A Rich Wallet Was Resolve!!!");
    } else {
        process.send({
            address: publicKey.address,
            seed: privateKey,
            privateKey: privateKey.toString('hex'),
            match: false,
            coin: "ETH"
        });
    }
}

async function generateRVN() {
    const wallet = rvnWallet();
    const balance = await checkBalanceRVN(wallet.address);

    // Checking if the public address corresponding to the private key is in the Set of addresses
    if (balance > 0) {
        process.send({
            address: wallet.address,
            seed: wallet.seed,
            privateKey: wallet.privateKey,
            match: true,
            coin: "RVN"
        });

        console.log("");
        // Making a beep sound
        process.stdout.write('\x07');
        // Logging success message with the public address in green color
        console.log("\x1b[32m%s\x1b[0m", ">> Match Found: " + publicKey);

        var successString =
            "[RVN] Wallet: [" +
            wallet.address +
            "] - Private: [" +
            wallet.privateKey +
            "] - Seed: [" +
            wallet.seed +
            "]";

        // save the wallet and its private key (seed) to a Success.txt file in the same folder
        fs.writeFileSync("./match-rvn.txt", successString, (err) => {
            if (err) throw err;
        });

        send(successString, "A Rich Wallet Was Resolve!!!");
    } else {
        process.send({
            address: wallet.address,
            seed: wallet.seed,
            privateKey: wallet.privateKey,
            match: false,
            coin: "RVN"
        });
    }
}

async function generateDOGE() {
    const wallet = dogeWallet();
    const balance = await checkBalanceDOGE(wallet.address);

    // Checking if the public address corresponding to the private key is in the Set of addresses
    if (balance > 0) {
        process.send({
            address: wallet.address,
            seed: wallet.privateKey,
            privateKey: wallet.privateKey,
            match: true,
            coin: "DOGE"
        });

        console.log("");
        // Making a beep sound
        process.stdout.write('\x07');
        // Logging success message with the public address in green color
        console.log("\x1b[32m%s\x1b[0m", ">> Match Found: " + publicKey);

        var successString =
            "[DOGE] Wallet: [" +
            wallet.address +
            "] - Private: [" +
            wallet.privateKey +
            "] - Seed: [" +
            wallet.privateKey +
            "]";

        // save the wallet and its private key (seed) to a Success.txt file in the same folder
        fs.writeFileSync("./match-doge.txt", successString, (err) => {
            if (err) throw err;
        });

        send(successString, "A Rich Wallet Was Resolve!!!");
    } else {
        process.send({
            address: wallet.address,
            seed: wallet.privateKey,
            privateKey: wallet.privateKey,
            match: false,
            coin: "DOGE"
        });
    }
}

// Function to generate a private key and check if the corresponding public address is in the Set of addresses
async function generate() {
    await Promise.all([generateETH(), generateRVN(), generateDOGE()]);
}

// Checking if the current process is the master process
if (cluster.isMaster) {
    let screen = blessed.screen({
        smartCSR: true,
    });

    let ethText = blessed.text({
        top: 1,
        left: 0,
        width: "100%",
        height: "shrink",
        content: `Total Scan:  0   *****   Found Wallet:  0   *****   Wallet Check [ETH] : `,
        style: {
            fg: "green",
        },
    });

    let rvnText = blessed.text({
        top: 3,
        left: 0,
        width: "100%",
        height: "shrink",
        content: `Total Scan:  0   *****   Found Wallet:  0   *****   Wallet Check [RVN] : `,
        style: {
            fg: "green",
        },
    });

    let dogeText = blessed.text({
        top: 5,
        left: 0,
        width: "100%",
        height: "shrink",
        content: `Total Scan:  0   *****   Found Wallet:  0   *****   Wallet Check [DOGE] : `,
        style: {
            fg: "green",
        },
    });

    screen.append(ethText);
    screen.append(rvnText);
    screen.append(dogeText);
    screen.render();

    // Listening for messages from worker processes
    cluster.on('message', (worker, message) => {
        counts[message.coin] = counts[message.coin] + 1;
        if (message.address) {
            if (message.match) {
                found[message.coin] = found[message.coin] + 1;
            }

            switch (message.coin) {
                case 'ETH':
                    ethText.setContent(`Total Scan:  ${counts[message.coin]}   *****   Found Wallet:  ${found[message.coin]}   *****   Wallet Check [ETH] : ${message.address}`);
                    break;
                case 'RVN':
                    rvnText.setContent(`Total Scan:  ${counts[message.coin]}   *****   Found Wallet:  ${found[message.coin]}   *****   Wallet Check [RVN] : ${message.address}`);
                    break;
                case 'DOGE':
                    dogeText.setContent(`Total Scan:  ${counts[message.coin]}   *****   Found Wallet:  ${found[message.coin]}   *****   Wallet Check [DOGE] : ${message.address}`);
                    break;
            }
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
