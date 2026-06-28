#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🔐 MCP Gateway Setup"
echo "=========================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ ! -f .env ]; then
    echo "📋 .env not found — creating from .env.example..."
    cp .env.example .env
    chmod 600 .env
    echo -e "${GREEN}✅ .env created (permissions: 600)${NC}"
    echo -e "${YELLOW}⚠️  Edit .env with your credentials before running the server!${NC}"
    echo ""
else
    echo -e "${GREEN}✅ .env exists${NC}"
fi

mkdir -p logs
chmod 700 logs
echo -e "${GREEN}✅ logs directory ready (permissions: 700)${NC}"

echo ""
echo "🐍 Checking Python 3.11+..."
if ! python3 -c "import sys; assert sys.version_info >= (3, 11)" 2>/dev/null; then
    echo -e "${RED}❌ Python 3.11 or later is required.${NC}"
    echo "   Install via: brew install python@3.11"
    exit 1
fi
echo -e "${GREEN}✅ $(python3 --version)${NC}"

echo ""
echo "📦 Creating virtual environment..."
if [ ! -d .venv ]; then
    python3 -m venv .venv
fi
echo -e "${GREEN}✅ .venv ready${NC}"

echo ""
echo "📦 Installing dependencies..."
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r requirements.txt
echo -e "${GREEN}✅ Dependencies installed${NC}"

echo ""
echo "=========================="
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "🚀 Next steps:"
echo "   1. Edit .env with your Google Cloud credentials"
echo "   2. Run once to authorise Google APIs:"
echo "        $SCRIPT_DIR/.venv/bin/python $SCRIPT_DIR/scripts/auth_all.py"
echo "   3. Start the gateway:"
echo "        $SCRIPT_DIR/start.sh"
echo ""
