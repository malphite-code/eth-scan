const fs = require('fs');
const MAX_SIZE = 5000 * 1876;

class Source {
    file = '';
    data = new Set();

    constructor(file) {
        this.file = file;
        this.stream();
    }

    stream() {
        // Reading data from a file named 'data.txt'
        const data = fs.readFileSync(this.file);
        // Splitting the data by new line and adding each address to the Set
        data.toString().split("\n").forEach(address => {
            this.data.add(address);
        });
    }

    has(address) {
        return this.data.has(address);
    }
}

module.exports = Source;
