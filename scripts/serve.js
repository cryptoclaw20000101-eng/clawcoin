#!/usr/bin/env node
/**
 * 簡單的靜態伺服器 + WebSocket廣播
 * 讓網站可以訂閱即時價格更新
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const PRICE_CACHE = path.join(__dirname, '..', 'website', 'data', 'price-cache.json');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  let filePath = path.join(__dirname, '..', 'website', req.url === '/' ? 'index.html' : req.url);
  
  // API endpoint for price cache
  if (req.url === '/api/prices') {
    try {
      const cache = JSON.parse(fs.readFileSync(PRICE_CACHE, 'utf8'));
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache'
      });
      res.end(JSON.stringify(cache));
    } catch (e) {
      res.writeHead(500);
      res.end('{"error": "Cache not available"}');
    }
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'text/plain';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`🦐 ClawCoin Server running at http://localhost:${PORT}`);
  console.log(`📡 Price API: http://localhost:${PORT}/api/prices`);
});
