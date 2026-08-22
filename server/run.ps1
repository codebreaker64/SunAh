# Start the Sun Ah TTS server. Blueprint sections 6 and 7e.
#
#   .\run.ps1
#
# Close Chrome first. The 3050 has 4 GB and the model wants 2.7 of them;
# anything else on the GPU and generation OOMs.

# Scoped to this process, not the machine: other projects on this laptop keep
# their existing HuggingFace caches. Section 1 wants it somewhere deletable in
# one command rather than buried in the user profile.
$env:HF_HOME = "C:\hf"

if (-not (Test-Path $env:HF_HOME)) { New-Item -ItemType Directory -Force $env:HF_HOME | Out-Null }

# Windows Developer Mode is ON, so huggingface_hub symlinks its blobs instead
# of copying them. Without that every model costs twice its size on disk.
Write-Host "HF_HOME = $env:HF_HOME"
Write-Host "Free space: $([math]::Round((Get-PSDrive C).Free/1GB,1)) GB"
Write-Host ""

# 0.0.0.0, not 127.0.0.1 — the phone is a different machine on your hotspot
# and localhost resolves to the phone.
uvicorn main:app --host 0.0.0.0 --port 8000
