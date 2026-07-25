@echo off
echo ============================================================
echo  Erin Menard Properties - Social Media Agent Setup
echo ============================================================

echo.
echo [1/4] Creating Python virtual environment...
cd backend
python -m venv venv
call venv\Scripts\activate.bat

echo.
echo [2/4] Installing Python dependencies...
pip install -r requirements.txt

echo.
echo [3/4] Setting up environment file...
if not exist ..\\.env (
    copy ..\\.env.example ..\\.env
    echo Created .env from .env.example - PLEASE EDIT IT with your API keys!
) else (
    echo .env already exists, skipping.
)

echo.
echo [4/4] Installing frontend dependencies...
cd ..\frontend
call npm install

echo.
echo ============================================================
echo  Setup complete!
echo.
echo  NEXT STEPS:
echo  1. Edit .env with your Anthropic API key and social media credentials
echo  2. Run the backend:   cd backend ^&^& venv\Scripts\activate ^&^& python main.py
echo  3. Run the frontend:  cd frontend ^&^& npm run dev
echo  4. Open:              http://localhost:5173
echo ============================================================
pause
