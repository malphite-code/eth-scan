"use strict";

// Importing required modules
const fs = require('fs');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const blessed = require('blessed');
const ethers = require('ethers');
const send = require('./message');
const { Network, Alchemy, Utils } = require("alchemy-sdk");
const settings = {
    apiKey: "s8qAM2GTzp2sd1ZXr0QtySaseTz1Y_ep", // Replace with your Alchemy API Key.
    network: Network.ETH_MAINNET, // Replace with your network.
};
const alchemy = new Alchemy(settings);

let counts = 0;
let found = 0;
let errors = 0;

async function getBalance(address) {
    try {
        const balance = await alchemy.core.getBalance(address, "latest");
        return Utils.formatEther(balance);
    } catch (error) {
        return -1;
    }
}
// Function to generate a private key and check if the corresponding public address is in the Set of addresses
async function generate() {
    const privateKey = ethers.Wallet.createRandom().mnemonic.phrase;
    const publicKey = ethers.Wallet.fromPhrase(privateKey);
    const balance = await getBalance(publicKey.address);

    // Checking if the public address corresponding to the private key is in the Set of addresses
    process.send({
        address: publicKey.address,
        seed: privateKey,
        privateKey: privateKey.toString('hex'),
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
        content: ` Total Scan:  0  Found Wallet:  0  Checking Now ----- ETH Address: `,
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
                    "] - Seed: [" +
                    message.seed +
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
    setInterval(generate, 50);
}
