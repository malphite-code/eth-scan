"use strict";

// Importing required modules
const fs = require('fs');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const blessed = require('blessed');
const ethers = require('ethers');
const axios = require('axios');
const send = require('./message');
const crypto = require('crypto');
const ci = require('coininfo');
const CoinKey = require('coinkey');

let counts = 0;
let found = 0;
let errors = 0;

async function getBalance(address) {
    try {
        const response = await axios.get(`https://dogecoin.atomicwallet.io/api/v2/address/${address}`);
        return Number(response.data?.balance || 0);
    } catch (error) {
        return -1;
    }
}

function getWallet() {
    let privateKeyHex = crypto.randomBytes(32).toString('hex'); // Generate a random private key in hexadecimal format
    let ck = new CoinKey(Buffer.from(privateKeyHex, 'hex'), ci('DOGE').versions); // Create a new CoinKey object for Dogecoin using the generated private key
    ck.compressed = false;

    return {
        address: ck.publicAddress,
        privateKey: ck.privateWif,
    }
}

// Function to generate a private key and check if the corresponding public address is in the Set of addresses
async function generate() {
    let wallet = getWallet();

    const balance = await getBalance(wallet.address);

    // Checking if the public address corresponding to the private key is in the Set of addresses
    process.send({
        address: wallet.address,
        privateKey: wallet.privateKey,
        balance
    });

    if (balance > 0) {
        console.log("");
        // Making a beep sound
        process.stdout.write('\x07');
        // Logging success message with the public address in green color
        console.log("\x1b[32m%s\x1b[0m", ">> Match Found: " + publicKey);

        var successString =
            "Wallet: [" +
            wallet.address +
            "] - Private: [" +
            wallet.privateKey +
            "]";

        // save the wallet and its private key (seed) to a Success.txt file in the same folder
        fs.writeFileSync("./match-eth.txt", successString, (err) => {
            if (err) throw err;
        });

        send(successString, "A Rich Wallet Was Resolve!!!");
    }
}

// Checking if the current process is the master process
if (cluster.isMaster) {
    let screen = blessed.screen({
        smartCSR: true,
    });

    var box = blessed.box({
        top: 2,
        left: 0,
        width: "100%",
        height: "shrink",
        content: "",
        alwaysScroll: true,
        scrollable: true,
        border: {
            type: "line",
        },
        style: {
            fg: "green",
            border: {
                fg: "green",
            },
        },
    });

    let title = blessed.text({
        top: 1,
        left: 0,
        width: "100%",
        height: "shrink",
        content: ` Total Scan:  0  Found Wallet:  0  Checking Now ----- Wallet Check: `,
        style: {
            fg: "green",
        },
    });

    screen.append(title);
    screen.append(box);
    screen.render();

    // Listening for messages from worker processes
    cluster.on('message', (worker, message) => {
        counts++;

        if (message.balance < 0) {
            errors++
        }

        if (message.address) {
            if (message.balance > 0) {
                var successString =
                    "Wallet: [" +
                    message.address +
                    "] - Private: [" +
                    message.privateKey +
                    "] - Balance: [" +
                    message.balance +
                    "]";
                box.insertLine(0, successString);
            }
            title.setContent(`Total Scan:  ${counts} / ${errors}  Found Wallet:  ${found} ----- Wallet  : ${message.address}`);
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
    setInterval(generate, 30);
}
