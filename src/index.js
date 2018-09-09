'use strict';

const path = require('path')
const mkdir = require('./mkdir')

// make sure there is '/vms' folder
mkdir(path.join(process.cwd(), 'vms'))