'use strict';

const path = require('path');
const express = require('express');

const app = express();
const public_dir = path.join(process.cwd(), 'public');

app.use(express.static(public_dir));

app.get('/', (req, res) => {
	res.sendFile(path.join(public_dir, 'index.htm'));
});

app.listen(80, () => console.log('HTTP server started', { port: 80 }));