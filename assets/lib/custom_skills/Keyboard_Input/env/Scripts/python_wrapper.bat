@echo off
setlocal enabledelayedexpansion

REM ---------------------------------
REM Define paths
REM ---------------------------------
set BASE_DIR=%~dp0
set ENV_META=%BASE_DIR%..\env_meta.json
set DEP_REG=%BASE_DIR%..\..\..\..\global_deps\dep_registry.json

REM ---------------------------------
REM Read python_version from env_meta.json
REM ---------------------------------
for /f "usebackq delims=" %%i in (
  `python -c "import json; print(json.load(open(r'%ENV_META%')).get('python_version', ''))"`
) do set PY_VER=%%i

if "%PY_VER%"=="" (
  echo [ERROR] No python_version found in env_meta.json
  exit /b 1
)

REM ---------------------------------
REM Look up Python interpreter path from dep_registry.json
REM ---------------------------------
for /f "usebackq delims=" %%i in (
  `python -c "import json; print(json.load(open(r'%DEP_REG%'))['python_interpreters'].get('%PY_VER%', ''))"`
) do set PY_EXE=%%i

if "%PY_EXE%"=="" (
  echo [ERROR] Python version %PY_VER% not found in dep_registry.json
  exit /b 1
)

REM ---------------------------------
REM Read python_paths from env_meta.json
REM ---------------------------------
for /f "usebackq delims=" %%i in (
  `python -c "import json; print(';'.join(json.load(open(r'%ENV_META%')).get('python_paths', [])))"`
) do set PY_PATHS=%%i

REM ---------------------------------
REM Set PYTHONPATH
REM ---------------------------------
set PYTHONPATH=%PY_PATHS%;%PYTHONPATH%

REM ---------------------------------
REM Debug info
REM ---------------------------------
echo [INFO] Using Python %PY_VER% at %PY_EXE%
echo [INFO] PYTHONPATH = %PYTHONPATH%

REM ---------------------------------
REM Execute target script
REM ---------------------------------
"%PY_EXE%" -u %*

endlocal
