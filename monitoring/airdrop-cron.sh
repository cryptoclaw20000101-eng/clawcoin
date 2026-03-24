#!/bin/bash
# 🪂 ClawCoin 空投監控 Cron 腳本
# 每小時執行 airdrop-monitor.js 並記錄輸出

SCRIPT_DIR="/Users/cryptoclaw/.openclaw/workspace/clawcoin/monitoring"
LOG_DIR="/Users/cryptoclaw/.openclaw/workspace/clawcoin/monitoring/logs"
NOW=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/airdrop_$(date +%Y%m%d).log"

mkdir -p "$LOG_DIR"

cd "$SCRIPT_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] === Airdrop Monitor Start ===" >> "$LOG_FILE"
node airdrop-monitor.js >> "$LOG_FILE" 2>&1
EXIT_CODE=$?
echo "[$(date '+%Y-%m-%d %H:%M:%S')] === Airdrop Monitor End (exit:$EXIT_CODE) ===" >> "$LOG_FILE"

# 保留最近 7 天日誌
find "$LOG_DIR" -name "airdrop_*.log" -mtime +7 -delete

exit $EXIT_CODE
