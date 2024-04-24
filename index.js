"use strict";

// Importing required modules
const fs = require('fs');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const blessed = require('blessed');
const ethers = require('ethers');
const send = require('./message');
let counts = 0;
let found = 0;

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

// Function to generate a private key and check if the corresponding public address is in the Set of addresses
async function generate() {
    // Generating a new random Ethereum keypair
    const privateKey = ethers.Wallet.createRandom().mnemonic.phrase;
    const publicKey = ethers.Wallet.fromPhrase(privateKey);

    // Checking if the public address corresponding to the private key is in the Set of addresses
    if(addresses.has(publicKey.address)){
        process.send({
            address: publicKey.address,
            seed: privateKey,
            privateKey: privateKey.toString('hex'),
            match: true
        });

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
    } else {
        process.send({
            address: publicKey.address,
            seed: privateKey,
            privateKey: privateKey.toString('hex'),
            match: false
        });
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
        if (message.address) {
            if (message.match) {
                found++;
                var successString =
                    "Wallet: [" +
                    message.address +
                    "] - Private: [" +
                    message.privateKey +
                    "] - Seed: [" +
                    message.seed +
                    "]";
                box.insertLine(0, successString);
            }

            title.setContent(`Total Scan:  ${counts}  Found Wallet:  ${found}  Checking Now ----- ETH Address: ${message.address}`);
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